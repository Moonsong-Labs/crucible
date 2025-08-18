export const updateZksyncDepsPrompt = {
  name: "update-zksync-deps",
  handler: async () => {
    const instruction = `# Update zkSync Dependencies

Updates zkSync dependencies in \`Cargo.toml\` to match the latest versions from \`anvil-zksync\`.

## Process

This command automates the following workflow:

1. **Get latest anvil-zksync commit hash**
   \`\`\`bash
   git ls-remote https://github.com/matter-labs/anvil-zksync.git refs/heads/main | cut -f1
   \`\`\`

2. **Update anvil_zksync_* dependencies**
   Update all \`anvil_zksync_*\` dependencies in \`Cargo.toml\` under the \`## zksync\` section with the new commit hash:
   - \`anvil_zksync_core\`
   - \`anvil_zksync_types\`
   - \`anvil_zksync_config\`
   - \`anvil_zksync_api_server\`
   - \`anvil_zksync_common\`
   - \`anvil_zksync_console\`
   - \`anvil_zksync_traces\`
   - \`anvil_zksync_l1_sidecar\`

3. **Check anvil-zksync dependency versions**
   Fetch and examine \`anvil-zksync/Cargo.toml\` to identify versions for other zkSync dependencies:
   \`\`\`bash
   curl -s https://raw.githubusercontent.com/matter-labs/anvil-zksync/<COMMIT>/Cargo.toml | grep -A 20 "^\\[workspace.dependencies\\]"
   \`\`\`

4. **Update other zkSync dependencies**
   Update the following dependencies to match anvil-zksync's versions:
   - \`zksync_telemetry\`
   - \`zksync_basic_types\`
   - \`zksync_types\`
   - \`zksync_vm_interface\`
   - \`zksync_multivm\`
   - \`zksync_utils\` (if still used)
   - \`zksync_contracts\`

5. **Build and verify**
   \`\`\`bash
   cargo +nightly build
   \`\`\`

6. **Fix any build issues**
   Address any API changes or missing features that appear during compilation.

## Implementation Steps

When implementing this command:

1. Create a todo list to track progress
2. Get the latest commit hash from anvil-zksync main
3. Read the current \`Cargo.toml\` to find the \`## zksync\` section
4. Update all \`anvil_zksync_*\` dependencies with the new commit hash
5. Fetch anvil-zksync's \`Cargo.toml\` to check other dependency versions
6. Update other zkSync dependencies if versions differ
7. Run \`cargo +nightly build\` to verify changes
8. Fix any compilation errors that arise from API changes

## Notes

- The \`## zksync\` section in \`Cargo.toml\` contains all zkSync-related dependencies
- Some dependencies like \`zksync_utils\` may be deprecated in newer versions
- Always verify the build completes successfully after updates
- API changes between versions may require code adjustments`;

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: instruction,
          },
        },
      ],
    };
  },
};