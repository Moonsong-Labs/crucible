export const upstreamInitPrompt = {
  name: "upstream-init",
  description:
    "Initializes the upstream merge process (sequential order): fetch commit history, detect conflicts, then generate sequential batching strategy",
  handler: async (args: { [x: string]: string | undefined }) => {
    const target = args.target ?? "<target>";
    const instruction = `
Initialize an upstream merge workspace and plan sequential batches.

Steps:
1) Call the tool fetch-commit-history with endCommit=${target}
   - This creates .claude/upstream/${target}/commit-history.md
   - Capture the "File location" from the tool output to get the exact path

2) Call the tool detect-conflicts with commitListFile set to the commit-history.md path
   - Do not pass outputFile; let the tool write to .claude/upstream/${target}/conflicts.yaml

3) Read the generated conflicts.yaml and plan batches
   - Group consecutive non-conflicting commits
   - Process each conflicting commit individually
   - NEVER skip commits; preserve chronological order

Outputs in .claude/upstream/${target}/:
- commit-history.md (tool: fetch-commit-history)
- conflicts.yaml (tool: detect-conflicts)
- conflict-analysis.md (LLM: analysis and batching strategy)
- merge-status.md (LLM: progress checklist)

Constraints:
- Use ONLY these two tools; do not look for other scripts
- Keep all outputs under the same .claude/upstream/${target}/ directory
- Maintain chronological processing order; never reorder across the history

Notes for batching:
- Group only consecutive non-conflicting commits into the same batch
- Put each conflicting commit in its own batch
- Provide brief rationale and any quick resolution tips per conflicting commit

### SEQUENTIAL BATCHING STRATEGY

**Example**: For commits c1, c2, c3, c4, c5 where c3 has HARD conflicts:

- Batch 1: c1 + c2 (consecutive non-conflicting)
- Batch 2: c3 (conflicting commit, processed alone)
- Batch 3: c4 + c5 (consecutive non-conflicting)

merge-status.md directives:
- It should contain only:
  - Total commits
  - Merged commits
  - A list of all batches
    - For each batch: state whether it is a clean merge or conflicting
    - For each batch: list all commits in that batch
      - For each commit: include a status
- Do not add additional information than this
`;

    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: instruction },
        },
      ],
    };
  },
};
