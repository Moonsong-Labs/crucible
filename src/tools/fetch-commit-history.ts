import { z } from "zod";

async function run(cmd: string[], options?: { cwd?: string }) {
  const proc = Bun.spawn(cmd, {
    cwd: options?.cwd ?? process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), code: proc.exitCode };
}

export const fetchCommitHistoryTool = {
  name: "fetch-commit-history",
  description:
    "Fetches commit history between auto-detected base and an end commit (default: latest upstream)",
  inputSchema: {
    endCommit: z.string().optional(),
  },
  handler: async ({ endCommit }: { endCommit?: string }) => {
    try {
      const repoCheck = await run(["git", "rev-parse", "--git-dir"]);
      if (repoCheck.code !== 0) {
        return {
          content: [
            { type: "text" as const, text: "Error: Not in a git repository" },
          ],
        };
      }

      const remotes = await run(["git", "remote"]);
      if (!remotes.stdout.split("\n").includes("upstream")) {
        const remoteV = await run(["git", "remote", "-v"]);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: No 'upstream' remote found\nAvailable remotes:\n${remoteV.stdout}`,
            },
          ],
        };
      }

      await run(["git", "fetch", "upstream"]);

      let upstreamDefaultBranch = "upstream/main";
      const upstreamHead = await run([
        "git",
        "symbolic-ref",
        "refs/remotes/upstream/HEAD",
      ]);
      if (upstreamHead.code === 0 && upstreamHead.stdout.trim()) {
        upstreamDefaultBranch = upstreamHead.stdout
          .trim()
          .replace("refs/remotes/", "");
      } else {
        const hasUpstreamMain =
          (await run(["git", "rev-parse", "--verify", "upstream/main"]))
            .code === 0;
        const hasUpstreamMaster =
          (await run(["git", "rev-parse", "--verify", "upstream/master"]))
            .code === 0;
        if (hasUpstreamMain) upstreamDefaultBranch = "upstream/main";
        else if (hasUpstreamMaster) upstreamDefaultBranch = "upstream/master";
        else {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No upstream default branch found (tried upstream/main, upstream/master)",
              },
            ],
          };
        }
      }

      const resolvedEndSpec = endCommit ?? upstreamDefaultBranch;

      const upstreamDefaultCheck = await run([
        "git",
        "rev-parse",
        "--verify",
        upstreamDefaultBranch,
      ]);
      if (upstreamDefaultCheck.code !== 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: upstream default branch ${upstreamDefaultBranch} not found`,
            },
          ],
        };
      }

      let startCommit = (
        await run(["git", "merge-base", "HEAD", upstreamDefaultBranch])
      ).stdout;
      if (!startCommit) {
        const hasLocalMain =
          (await run(["git", "rev-parse", "--verify", "main"])).code === 0;
        if (hasLocalMain) {
          startCommit = (
            await run(["git", "merge-base", "main", upstreamDefaultBranch])
          ).stdout;
        } else {
          const hasLocalMaster =
            (await run(["git", "rev-parse", "--verify", "master"])).code === 0;
          if (hasLocalMaster) {
            startCommit = (
              await run(["git", "merge-base", "master", upstreamDefaultBranch])
            ).stdout;
          }
        }
      }
      if (!startCommit) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Could not auto-detect base commit",
            },
          ],
        };
      }

      const startHash = (
        await run(["git", "rev-parse", "--short", startCommit])
      ).stdout;
      const endHash = (
        await run(["git", "rev-parse", "--short", resolvedEndSpec!])
      ).stdout;
      if (!startHash) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Start commit ${startCommit} not found`,
            },
          ],
        };
      }
      if (!endHash) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: End commit ${resolvedEndSpec} not found`,
            },
          ],
        };
      }

      const targetDir = `.claude/upstream/${endHash}`;
      await run(["mkdir", "-p", targetDir]);
      const outputFile = `${targetDir}/commit-history.md`;

      const commitRange = await run([
        "git",
        "rev-list",
        "--reverse",
        `${startCommit}..${resolvedEndSpec}`,
      ]);
      if (commitRange.code !== 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Failed to get commit range ${startHash}..${endHash}`,
            },
          ],
        };
      }
      const commits = commitRange.stdout.split("\n").filter(Boolean);

      let fileContent = `# Commit History from ${startHash} to ${endHash}\n\n`;
      for (const c of commits) {
        const line = (
          await run(["git", "log", "-1", "--pretty=format:- %h %s", c])
        ).stdout;
        if (line) fileContent += `${line}\n`;
      }

      await Bun.write(outputFile, fileContent);

      const result = [
        `Successfully created ${outputFile} with ${commits.length} commits`,
        `File location: ${process.cwd()}/${outputFile}`,
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error}`,
          },
        ],
      };
    }
  },
};
