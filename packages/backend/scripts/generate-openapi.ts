import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"; // Use the correct import for your Zod version
import router from "../src/routes"; // Import your defined oRPC router
import * as fs from "fs";

async function generateSpec() {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const spec = await generator.generate(router, {
    info: {
      title: "Your API Title",
      version: "1.0.0",
    },
  });

  // Output the specification to a JSON file
  fs.writeFileSync("openapi.json", JSON.stringify(spec, null, 2));
  console.log("OpenAPI specification generated successfully!");
}

generateSpec().catch(console.error);
