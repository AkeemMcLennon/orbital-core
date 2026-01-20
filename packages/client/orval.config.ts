import { defineConfig, OpenApiOperationObject } from "orval";

type OrvalConfig = ReturnType<typeof defineConfig>;

export const config: OrvalConfig = defineConfig({
  orbital: {
    input: {
      target: "../backend/openapi.json",
      override: {
        transformer: (inputSchema) => {
          // 1. Define your standard 400 error schema
          const error400Schema = {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    status: { type: "number" },
                  },
                  required: ["message"],
                },
              },
            },
          };
          const error401Schema = {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    status: { type: "number" },
                  },
                  required: ["message"],
                },
              },
            },
          };
          const error404Schema = {
            description: "Not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    status: { type: "number" },
                  },
                  required: ["message"],
                },
              },
            },
          };
          const paths = inputSchema.paths || [];

          // 2. Iterate over all paths and verbs (get, post, put, etc.)
          Object.values(paths).forEach((pathItem) => {
            if (!pathItem) {
              return;
            }
            Object.keys(pathItem).forEach((verb) => {
              // specific operations only (skip 'parameters', 'summary', etc.)
              if (["get", "post", "put", "delete", "patch"].includes(verb)) {
                const operation: OpenApiOperationObject = pathItem[verb];
                if (!operation.responses) {
                  return;
                }

                // Assume anything with input parameters can 404
                if (operation.parameters) {
                  operation.responses["404"] = error404Schema;
                }
                // Assume all non-GET responses can 400
                if (!operation.responses["400"] && verb != "get") {
                  operation.responses["400"] = error400Schema;
                }
                // Assume all responses can 401
                if (!operation.responses["401"]) {
                  operation.responses["401"] = error401Schema;
                }
              }
            });
          });

          console.log(JSON.stringify(inputSchema.paths, null, 2));

          return inputSchema;
        },
      },
    },
    output: {
      target: "src/generated/client.ts",
      client: "fetch",
      prettier: true,
      mode: "single",
      override: {
        fetch: {
          includeHttpResponseReturnType: true,
        },
        mutator: {
          path: "./src/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
    hooks: {
      afterAllFilesWrite: ["prettier --write"],
    },
  },
});

export default config;
