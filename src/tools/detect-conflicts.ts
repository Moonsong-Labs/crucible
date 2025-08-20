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

function parseCommitLine(
  line: string
): { hash: string; message: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const withoutBullet = trimmed.replace(/^[-*]\s+/, "");
  const match = withoutBullet.match(/^([0-9a-fA-F]{7,40})\b(?:\s+(.*))?$/);
  if (!match) return null;
  return { hash: match[1], message: (match[2] ?? "").trim() };
}

function countMatches(text: string, pattern: RegExp): number {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"
  );
  return (text.match(global) || []).length;
}

async function analyzeConflictContent(filePath: string) {
  try {
    const text = await Bun.file(filePath).text();
    const lines = text.split(/\r?\n/);
    const conflictMarkers =
      countMatches(text, /^<<<<<<< /m) +
      countMatches(text, /^=======$/m) +
      countMatches(text, /^>>>>>>> /m);

    let complexity = "unknown";
    if (conflictMarkers <= 2) complexity = "simple";
    else if (conflictMarkers <= 6) complexity = "moderate";
    else complexity = "complex";

    let conflictType = "unknown";
    const headIndex = lines.findIndex((l) => /^<<<<<<< HEAD/.test(l));
    if (headIndex !== -1) {
      const start = Math.max(0, headIndex - 5);
      const end = Math.min(lines.length, headIndex + 6);
      const windowText = lines.slice(start, end).join("\n");
      if (/(^|\n).*\b(import|include|require)\b/.test(windowText))
        conflictType = "import_conflict";
      else if (/(^|\n).*\b(function|def|method)\b/.test(windowText))
        conflictType = "function_conflict";
      else if (/(^|\n).*\b(class|struct|interface)\b/.test(windowText))
        conflictType = "class_conflict";
      else if (
        /^\s*$/.test(lines[Math.max(0, headIndex - 2)] ?? "") ||
        /^\s*$/.test(lines[Math.min(lines.length - 1, headIndex + 2)] ?? "")
      )
        conflictType = "whitespace_conflict";
      else conflictType = "content_conflict";
    }

    // Extract full conflict blocks (from <<<<<<< to >>>>>>>), include all blocks
    const blocks: string[] = [];
    let inBlock = false;
    let blockStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inBlock && /^<<<<<<< /.test(line)) {
        inBlock = true;
        blockStart = i;
      } else if (inBlock && /^>>>>>>> /.test(line)) {
        blocks.push(lines.slice(blockStart, i + 1).join("\n"));
        inBlock = false;
        blockStart = -1;
      }
    }

    let context = "";
    if (blocks.length > 0) {
      context = blocks.join("\n\n");
    } else {
      const contextStart = lines.findIndex((l) => /^<<<<<<< HEAD/.test(l));
      if (contextStart !== -1) {
        const start = Math.max(0, contextStart - 3);
        const end = Math.min(lines.length, contextStart + 4);
        context = lines.slice(start, end).join("\n");
      }
    }

    return { conflictType, complexity, conflictMarkers, context };
  } catch {
    return {
      conflictType: "unknown",
      complexity: "unknown",
      conflictMarkers: 0,
      context: "",
    };
  }
}

async function getFileStats(filePath: string, commit: string) {
  const res = await run(["git", "show", "--numstat", commit, "--", filePath]);
  const line = res.stdout.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const parts = line.split(/\t+/);
  const additions = parseInt(parts[0] || "0", 10) || 0;
  const deletions = parseInt(parts[1] || "0", 10) || 0;
  return { additions, deletions };
}

async function determineMergeType(filePath: string) {
  const res = await run(["git", "ls-files", "-u", filePath]);
  const hasStage1 = /\s1\t/.test(res.stdout) || /\s1\s/.test(res.stdout);
  const hasStage2 = /\s2\t/.test(res.stdout) || /\s2\s/.test(res.stdout);
  const hasStage3 = /\s3\t/.test(res.stdout) || /\s3\s/.test(res.stdout);
  if (hasStage1) {
    if (hasStage3) return "modify/modify";
    return "delete/modify";
  }
  if (hasStage2) return "modify/delete";
  return "unknown";
}

export const detectConflictsTool = {
  name: "detect-conflicts",
  description:
    "Detects cherry-pick conflicts for a list of commits and outputs YAML report",
  inputSchema: {
    commitListFile: z.string(),
    outputFile: z.string().optional(),
  },
  handler: async ({
    commitListFile,
    outputFile,
  }: {
    commitListFile: string;
    outputFile?: string;
  }) => {
    try {
      const repoCheck = await run(["git", "rev-parse", "--git-dir"]);
      if (repoCheck.code !== 0) {
        return {
          content: [
            { type: "text" as const, text: "Error: Not in a git repository" },
          ],
        };
      }

      const listText = await Bun.file(commitListFile).text();
      const commitLines = listText.split(/\r?\n/);
      const commits: { hash: string; message: string }[] = [];
      for (const line of commitLines) {
        const parsed = parseCommitLine(line);
        if (parsed) commits.push(parsed);
      }
      if (commits.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: No commits found in ${commitListFile}`,
            },
          ],
        };
      }

      const currentBranchRes = await run([
        "git",
        "rev-parse",
        "--abbrev-ref",
        "HEAD",
      ]);
      const currentBranch = currentBranchRes.stdout || "HEAD";
      const tempBranch = `conflict-detection-${Date.now()}`;

      const checkoutRes = await run(["git", "checkout", "-b", tempBranch]);
      if (checkoutRes.code !== 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Could not create temporary branch",
            },
          ],
        };
      }

      let total = 0;
      let clean = 0;
      let conflicts = 0;

      const latestCommit = commits[commits.length - 1];
      const latestShortHashRes = await run([
        "git",
        "rev-parse",
        "--short",
        latestCommit.hash,
      ]);
      const latestHashForPath = latestShortHashRes.stdout || latestCommit.hash;
      const outFile =
        outputFile || `.claude/upstream/${latestHashForPath}/conflicts.yaml`;
      await run(["mkdir", "-p", outFile.replace(/\/(?:[^/]+)$/u, "")]);

      let yaml = "conflicts:\n";

      for (const { hash, message } of commits) {
        total += 1;
        const cherry = await run(["git", "cherry-pick", "--no-commit", hash]);
        if (cherry.code === 0) {
          clean += 1;
          await run(["git", "reset", "--hard", "HEAD"]);
          continue;
        }

        conflicts += 1;

        yaml += `  - commit: "${hash}"\n`;
        yaml += "    files:\n";

        const diff = await run([
          "git",
          "diff",
          "--name-only",
          "--diff-filter=U",
        ]);
        const files = diff.stdout.split(/\r?\n/).filter(Boolean);
        for (const f of files) {
          const analysis = await analyzeConflictContent(f);
          yaml += `      - path: "${f}"\n`;
          yaml += `        conflict_type: "${analysis.conflictType}"\n`;
          yaml += `        complexity: "${analysis.complexity}"\n`;
          yaml += `        conflict_markers: ${analysis.conflictMarkers}\n`;
          if (analysis.context) {
            yaml += `        sample_conflict: |\n`;
            yaml +=
              analysis.context
                .split("\n")
                .map((l) => `          ${l}`)
                .join("\n") + "\n";
          }
        }

        await run(["git", "cherry-pick", "--abort"]);
        await run(["git", "reset", "--hard", "HEAD"]);
      }

      await Bun.write(outFile, yaml);

      await run(["git", "checkout", currentBranch]);
      await run(["git", "branch", "-D", tempBranch]);

      const result = [
        `Conflict detection complete!`,
        `Total: ${total}, Clean: ${clean}, Conflicts: ${conflicts}`,
        `Report saved to: ${process.cwd()}/${outFile}`,
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      try {
        const currentBranchRes = await run([
          "git",
          "rev-parse",
          "--abbrev-ref",
          "HEAD",
        ]);
        const currentBranch = currentBranchRes.stdout || "HEAD";
        await run(["git", "cherry-pick", "--abort"]);
        await run(["git", "reset", "--hard", "HEAD"]);
        await run(["git", "checkout", currentBranch]);
      } catch {}
      return { content: [{ type: "text" as const, text: `Error: ${error}` }] };
    }
  },
};
