export const upstreamPrompt = {
  name: "upstream",
  description:
    "Processes upstream commits sequentially (chronological order) with batching, conflict handling, and mandatory build/test after each batch",
  handler: async (args: { [x: string]: string | undefined }) => {
    const target = args.target ?? "<target>";
    const instruction = `Process upstream commits sequentially in chronological order.

Steps:
1) First run
   - Check for .claude/upstream/${target}/merge-status.md and .claude/upstream/${target}/conflict-analysis.md
   - If either file is missing: STOP and instruct the user to run upstream-init with the same target; do not attempt to create them yourself
   - Read .claude/upstream/${target}/conflict-analysis.md to understand batching strategy
   - Search memorizer MCP for prior resolutions using tags: 'conflict-resolution', 'upstream-merge'

2) Identify the next sequential batch of commits to process

3) For consecutive non-conflicting commits
   - Command: git cherry-pick <commit1> <commit2> ... <commitN>
   - Mark all as MERGED in merge-status.md if successful

4) For commits with conflicts
   - Spawn a conflict-resolution subagent scoped to the current commit
   - Attempt to resolve conflicts automatically
   - If unresolved: mark NEEDS_HELP and stop; request human help; do not skip

Build and test after each batch (mandatory):
- Build: cargo +nightly build
  - If build fails: stop; debug and fix; document in resolved-conflicts.md; proceed only after passing
- Test: ZK_DEBUG_HISTORICAL_BLOCK_HASHES=5 cargo +nightly nextest run --package '*' --lib --test '*' -E '(test(~zk) or package(~zksync)) and not test(~test_zk_aave_di)'
  - If tests fail: stop; investigate and fix; document the changes

Human help request process:
1. Stop processing immediately
2. Mark commit as NEEDS_HELP in merge-status.md
3. Store conflict details with memorizer MCP using tags: 'conflict-resolution', 'upstream-merge', <commit_hash>
4. Create a file: .claude/upstream/${target}/help-<commit_hash>.md
   - Include: commit hash, list of conflicting files, brief summary of conflicts, specific help needed
5. Provide clear instructions for human intervention, including exact commands:
   - Command: git cherry-pick <commit_hash>
   - Resolve conflicts in the listed files by removing conflict markers and applying the intended changes
   - Command: git add -A
   - Command: git cherry-pick --continue
   - Command: cargo +nightly build
   - Command: ZK_DEBUG_HISTORICAL_BLOCK_HASHES=5 cargo +nightly nextest run --package '*' --lib --test '*' -E '(test(~zk) or package(~zksync)) and not test(~test_zk_aave_di)'
6. After resolution, instruct the human to run the upstream prompt again with the same target to resume processing

Auto-resolved conflicts:
1. Stage resolved files: git add
2. Complete cherry-pick: git cherry-pick --continue
3. Preserve original commit message and author
4. Store resolution details with memorizer MCP using tags: 'conflict-resolution', 'upstream-merge', <commit_hash>

Build/Test failures:
1. Do not revert
2. Mark as NEEDS_HELP in merge-status.md
3. Document the failure with full error details
4. Request human intervention
5. Stop until resolved

Critical policy:
- Never skip commits
- Do not use shortcuts (no commenting out code, no temporary hacks, no ignoring type/API issues)
- Implement proper fixes that preserve both ZKsync and upstream functionality
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
