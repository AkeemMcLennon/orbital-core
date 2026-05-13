/**
 * Verification script for the metadata utility.
 * Run with: bun packages/mobile/scripts/test-metadata.ts
 *
 * Tests that fetchMetadata correctly extracts OG metadata from real URLs.
 */

import { fetchMetadata } from "../src/utils/metadata";

const USER_AGENTS: Record<string, string> = {
  "Mobile Safari (iOS 18)":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  "Chrome 124 (Android 13)":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Samsung Browser 23 (Android 13)":
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  "Chrome 124 (Windows)":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Firefox 125 (Windows)":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Safari 17 (macOS)":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Googlebot":
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "metadata.ts UA_FALLBACK (no UA passed)":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
};

const LINKEDIN_URL = "https://www.linkedin.com/in/williamhgates/";

const OTHER_URLS = [
  "https://www.instagram.com/natgeo/",
  "https://github.com/anthropics",
];

async function main() {
  console.log("=== LinkedIn UA test ===");
  for (const [name, ua] of Object.entries(USER_AGENTS)) {
    process.stdout.write(`\n[${name}]\n  → `);
    try {
      const result = await fetchMetadata(LINKEDIN_URL, ua);
      console.log(`title: ${result.title}`);
      console.log(`  image: ${result.image?.slice(0, 80) ?? "none"}`);
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`);
    }
  }

  console.log("\n\n=== Other URLs (default UA) ===");
  for (const url of OTHER_URLS) {
    console.log(`\n─── ${url} ───`);
    try {
      const result = await fetchMetadata(url);
      console.log("  title      :", result.title);
      console.log("  image      :", result.image?.slice(0, 80));
      console.log("  description:", result.description?.slice(0, 120));
    } catch (err) {
      console.error("  ERROR:", (err as Error).message);
    }
  }
}

main();
