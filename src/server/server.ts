import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateZksyncDepsPrompt } from "../prompts/update-zksync-deps.js";
import { fetchCommitHistoryTool } from "../tools/fetch-commit-history.js";

export function createServer() {
  const server = new McpServer({
    name: "crucible",
    version: "1.0.0",
  });

  // Register prompts
  server.registerPrompt(
    updateZksyncDepsPrompt.name,
    {
      title: updateZksyncDepsPrompt.name,
      description: updateZksyncDepsPrompt.description,
    },
    updateZksyncDepsPrompt.handler
  );

  // Register tools
  server.registerTool(
    fetchCommitHistoryTool.name,
    {
      title: fetchCommitHistoryTool.name,
      description: fetchCommitHistoryTool.description,
      inputSchema: fetchCommitHistoryTool.inputSchema,
    },
    fetchCommitHistoryTool.handler
  );

  return server;
}
