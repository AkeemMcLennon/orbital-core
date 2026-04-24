/**
 * Verification script for the metadata utility.
 * Run with: bun packages/mobile/scripts/test-metadata.ts
 *
 * Tests that fetchMetadata correctly extracts OG metadata from real URLs.
 */

import { fetchMetadata } from "../src/utils/metadata";

// Simulates the user agent that expo-constants provides at runtime on a real device.
const DEVICE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

const URLS = [
  "https://www.linkedin.com/in/williamhgates/",
  "https://www.instagram.com/natgeo/",
  "https://github.com/anthropics",
];

async function main() {
  for (const url of URLS) {
    console.log(`\n─── ${url} ───`);
    try {
      const result = await fetchMetadata(url, DEVICE_UA);
      console.log("  title      :", result.title);
      console.log("  image      :", result.image?.slice(0, 80));
      console.log("  description:", result.description?.slice(0, 120));
    } catch (err) {
      console.error("  ERROR:", (err as Error).message);
    }
  }
}

main();
