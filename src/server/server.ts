import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateZksyncDepsPrompt } from "../prompts/update-zksync-deps.js";

export function createServer() {
  const server = new McpServer({
    name: "crucible",
    version: "1.0.0",
  });

  // Register prompts
  server.prompt(updateZksyncDepsPrompt.name, updateZksyncDepsPrompt.handler);

  return server;
}