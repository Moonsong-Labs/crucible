# Crucible

Git upstream merge automation powered by Bun and the Model Context Protocol (MCP). Crucible provides tools and prompts to fetch commit history, detect conflicts, and drive a disciplined, sequential upstream merge process.

## Install & Run

```bash
bun install
bun start
```

## Add to Claude (MCP)

Use the short helper command to print the add command:

```bash
bun run add
```

Then paste the printed command into your terminal to register Crucible:

```bash
claude mcp add --transport stdio crucible "/absolute/path/to/index.ts"
```

## Prompts

**upstream-init**
What: Prepares `.claude/upstream/<target>/` (runs tools, produces history+conflicts, guides batching outputs)
Input: `{ target: string }`
Produces: commit-history.md (tool), conflicts.yaml (tool), conflict-analysis.md (LLM), merge-status.md (LLM)

**upstream**
What: Executes sequential batches in chronological order; requires prior init; spawns subagent on conflicts; build/test each batch
Input: `{ target: string }`
Requires: `.claude/upstream/<target>/merge-status.md` and `conflict-analysis.md`

**update-zksync-deps**
What: Updates zkSync dependencies in Cargo.toml to latest anvil-zksync versions
Input: `{}`

## Tools

**fetch-commit-history**
What: Lists commits from auto-detected base to endCommit; writes `.claude/upstream/<hash>/commit-history.md`
Input: `{ endCommit?: string }`

**detect-conflicts**
What: Cherry-picks to find conflicts; writes `.claude/upstream/<hash>/conflicts.yaml` with per-file details and full conflict blocks
Input: `{ commitListFile: string, outputFile?: string }`
