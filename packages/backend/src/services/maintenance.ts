import type { DatabaseClient } from "../database/client";
import { processAccountDeletions } from "./account-deletion";
import { runDailyTagDiscovery } from "./tag-discovery";

/**
 * Run scheduled maintenance against a database: process due account deletions
 * and daily tag discovery.
 *
 * This is the unit of work; the scheduling driver is deployment-specific. The
 * default Worker's `scheduled()` handler runs it once against the deployment's
 * database (tenantId = null); other drivers may invoke it with a specific
 * tenant id and that tenant's database.
 */
export async function runTenantMaintenance(
  db: DatabaseClient,
  tenantId: string | null,
): Promise<void> {
  const label = tenantId ? `maintenance ${tenantId}` : "maintenance";

  const deleted = await processAccountDeletions(db);
  console.log(`[${label}] Processed ${deleted} account deletion(s).`);

  const tagged = await runDailyTagDiscovery(db);
  console.log(`[${label}] Tag discovery processed ${tagged} active user(s).`);
}
