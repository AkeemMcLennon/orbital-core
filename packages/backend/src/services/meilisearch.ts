import { createHash } from "crypto";
import { Meilisearch } from "meilisearch";
import { generateTenantToken } from "meilisearch/token";
import { settings } from "../config";
import type { Contact } from "../database/schema";

const INDEX_NAME = "contacts";
const TOKEN_TTL_SECONDS = 3600;

const SEARCHABLE_ATTRS = [
  "name",
  "email",
  "phone",
  "jobTitle",
  "company",
  "tags",
];
const FILTERABLE_ATTRS = ["userId", "instanceHash"];

// The contact fields the index needs, derived from the canonical `Contact` schema
// (the same row type the contacts route uses) so they stay in sync with the table.
// Picking explicit fields — rather than spreading the full Drizzle row — keeps
// sensitive columns, notably the encrypted `notes` blob and internal timestamps,
// out of the search index.
export type IndexableContact = Pick<
  Contact,
  | "id"
  | "userId"
  | "name"
  | "email"
  | "phone"
  | "avatarUrl"
  | "jobTitle"
  | "company"
  | "birthday"
  | "group"
>;

// Meilisearch document stored in the index: the indexable contact fields plus the
// per-instance scoping hash and denormalized tag names.
export interface MeilisearchContact extends IndexableContact {
  instanceHash: string;
  tags: string[];
}

function isConfigured(): boolean {
  return !!(
    settings.MEILISEARCH_URL &&
    settings.MEILISEARCH_API_KEY &&
    settings.MEILISEARCH_API_KEY_UID &&
    // Required to derive the instance hash (see deriveInstanceHash).
    settings.DB_ENCRYPTION_KEY
  );
}

// Namespaces this deployment's documents within a (potentially shared) Meilisearch
// instance, so tenant tokens only ever match their own instance's rows. Derived from
// the DB encryption key + the Meilisearch API key UID rather than configured separately:
// any deployment sharing the same encryption key and API key resolves to the same hash,
// while a different key (or a rotated API key) yields a distinct namespace.
// Output is a 64-char hex SHA-256 digest — no quotes — so it stays filter-injection-safe.
//
// Computed once and cached. It isn't a module-level const because settings are populated
// lazily at startup, so the inputs aren't available at import time.
let instanceHash: string | undefined;
function deriveInstanceHash(): string {
  return (instanceHash ??= createHash("sha256")
    .update(`${settings.DB_ENCRYPTION_KEY}:${settings.MEILISEARCH_API_KEY_UID}`)
    .digest("hex"));
}

// Test hook: clears the memoized hash so it is recomputed from current settings.
function resetInstanceHashCache(): void {
  instanceHash = undefined;
}

class MeilisearchService {
  private indexConfigured = false;
  private configuring: Promise<void> | null = null;

  // Builds a fresh client from current settings (settings are mutated in place at startup,
  // so we read them lazily rather than caching a client at module load).
  private client(): Meilisearch {
    return new Meilisearch({
      host: settings.MEILISEARCH_URL!,
      apiKey: settings.MEILISEARCH_API_KEY!,
    });
  }

  // Map a contact row to a search document, picking only index-safe fields.
  private toDocument(
    contact: IndexableContact,
    tagNames: string[],
  ): MeilisearchContact {
    return {
      id: contact.id,
      userId: contact.userId,
      instanceHash: deriveInstanceHash(),
      name: contact.name,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      avatarUrl: contact.avatarUrl ?? null,
      jobTitle: contact.jobTitle ?? null,
      company: contact.company ?? null,
      birthday: contact.birthday ?? null,
      group: contact.group ?? null,
      tags: tagNames,
    };
  }

  async generateTenantToken(userId: string): Promise<string> {
    // userId is an internal base58 UUID and instanceHash is a hex SHA-256 digest —
    // neither can contain a single quote, so the filter string is injection-safe.
    return generateTenantToken({
      apiKey: settings.MEILISEARCH_API_KEY!,
      apiKeyUid: settings.MEILISEARCH_API_KEY_UID!,
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000),
      searchRules: {
        [INDEX_NAME]: {
          filter: `userId = '${userId}' AND instanceHash = '${deriveInstanceHash()}'`,
        },
      },
      // Cloudflare Workers is neither Node nor a recognized browser; skip the SDK's
      // environment check. Signing uses Web Crypto, which Workers supports.
      force: true,
    });
  }

  async indexContact(
    contact: IndexableContact,
    tagNames: string[],
  ): Promise<void> {
    if (!isConfigured()) return;

    await this.ensureIndexConfigured();
    await this.client()
      .index(INDEX_NAME)
      .addDocuments([this.toDocument(contact, tagNames)], { primaryKey: "id" });
  }

  // Index many contacts in a single request — used by bulk create. Tags are not
  // assigned during bulk create, so documents are indexed without them.
  async indexContacts(contacts: IndexableContact[]): Promise<void> {
    if (!isConfigured() || contacts.length === 0) return;

    await this.ensureIndexConfigured();
    await this.client()
      .index(INDEX_NAME)
      .addDocuments(
        contacts.map((c) => this.toDocument(c, [])),
        { primaryKey: "id" },
      );
  }

  async deleteContact(contactId: string): Promise<void> {
    if (!isConfigured()) return;

    await this.client().index(INDEX_NAME).deleteDocument(contactId);
  }

  // Called lazily before the first write to ensure the index exists with the right settings.
  // Concurrent first-time callers (e.g. a bulk insert firing many parallel writes) share a
  // single in-flight configuration promise. The flag is only set after success, so a
  // transient failure clears the promise and the next write retries.
  private ensureIndexConfigured(): Promise<void> {
    if (this.indexConfigured) return Promise.resolve();
    return (this.configuring ??= this.configureIndex()
      .then(() => {
        this.indexConfigured = true;
      })
      .finally(() => {
        this.configuring = null;
      }));
  }

  private async configureIndex(): Promise<void> {
    const client = this.client();
    // createIndex is idempotent at the task level — a duplicate enqueues a task that fails
    // harmlessly. The explicit primaryKey avoids ambiguity between `id` and `userId`.
    await client.createIndex(INDEX_NAME, { primaryKey: "id" });
    const index = client.index(INDEX_NAME);
    await index.updateFilterableAttributes(FILTERABLE_ATTRS);
    await index.updateSearchableAttributes(SEARCHABLE_ATTRS);
  }

  resetIndexConfigured(): void {
    this.indexConfigured = false;
  }

  markIndexConfigured(): void {
    this.indexConfigured = true;
  }
}

export const meilisearchService = new MeilisearchService();
export {
  isConfigured as isMeilisearchConfigured,
  deriveInstanceHash,
  resetInstanceHashCache,
  INDEX_NAME as MEILISEARCH_INDEX_NAME,
};
