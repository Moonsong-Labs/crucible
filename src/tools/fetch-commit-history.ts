import { z } from "zod";

export const fetchCommitHistoryTool = {
  name: "fetch-commit-history",
  description: "Executes the fetch commit history script with optional start and end commits",
  inputSchema: z.object({
    endCommit: z.string().optional().describe("End commit hash (if omitted, uses latest from main)"),
    startCommit: z.string().optional().describe("Start commit hash (if omitted, auto-detected using git merge-base)"),
  }),
  handler: async ({ endCommit, startCommit }: { endCommit?: string; startCommit?: string }) => {
    try {
      const scriptPath = `${import.meta.dir}/../scripts/fetch-commit-history.sh`;
      
      // Build command arguments
      const args = [];
      if (endCommit) args.push(endCommit);
      if (startCommit) args.push(startCommit);
      
      // Execute the script
      const proc = Bun.spawn(["/bin/bash", scriptPath, ...args], {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      });
      
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      
      await proc.exited;
      
      let output = "";
      if (stdout) output += `Output:\n${stdout}`;
      if (stderr) output += `\nErrors:\n${stderr}`;
      if (!stdout && !stderr) output = "Script executed successfully with no output";
      
      return {
        content: [
          {
            type: "text" as const,
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error executing script: ${error}`,
          },
        ],
      };
    }
  },
};