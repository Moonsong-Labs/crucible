import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateZksyncDepsPrompt } from "../prompts/update-zksync-deps.js";
import { upstreamInitPrompt } from "../prompts/upstream-init.js";
import { upstreamPrompt } from "../prompts/upstream.js";
import { fetchCommitHistoryTool } from "../tools/fetch-commit-history.js";
import { detectConflictsTool } from "../tools/detect-conflicts.js";

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

  server.registerPrompt(
    upstreamInitPrompt.name,
    {
      title: upstreamInitPrompt.name,
      description: upstreamInitPrompt.description,
    },
    upstreamInitPrompt.handler
  );

  server.registerPrompt(
    upstreamPrompt.name,
    {
      title: upstreamPrompt.name,
      description: upstreamPrompt.description,
    },
    upstreamPrompt.handler
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

  server.registerTool(
    detectConflictsTool.name,
    {
      title: detectConflictsTool.name,
      description: detectConflictsTool.description,
      inputSchema: detectConflictsTool.inputSchema,
    },
    detectConflictsTool.handler
  );

  return server;
}
