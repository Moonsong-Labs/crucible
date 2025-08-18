import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./src/server/server.js";

const server = createServer();

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Crucible MCP server started successfully");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});