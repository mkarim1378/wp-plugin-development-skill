// Test double for the `claude` CLI used by tests/run-evals.test.mjs.
// Agent mode (stream-json): pretends to load a skill, read a reference and edit the plugin.
// Judge mode (--json-schema): returns a fixed verdict.
// FAKE_CLAUDE_MODE=auth-error simulates an unauthenticated CLI.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);

if (process.env.FAKE_CLAUDE_MODE === "auth-error") {
  emit({ type: "result", subtype: "success", is_error: true, result: "Failed to authenticate. API Error: 401", total_cost_usd: 0 });
  process.exit(0);
}

if (args.includes("--json-schema")) {
  process.stdout.write(
    JSON.stringify({
      type: "result",
      is_error: false,
      total_cost_usd: 0.01,
      structured_output: {
        criteria: [
          { criterion: "Uses Settings API", pass: true, evidence: "register_setting in diff" },
          { criterion: "Nonce is present", pass: false, evidence: "not shown" },
        ],
        expected_steps: [{ step: "Load settings-api.md", observed: true }],
        summary: "Partially done.",
      },
    })
  );
  process.exit(0);
}

const cwd = process.cwd();
emit({ type: "system", subtype: "init" });
emit({
  type: "assistant",
  message: {
    content: [
      { type: "tool_use", name: "Skill", input: { skill: "wp-plugin-development" } },
      { type: "tool_use", name: "Read", input: { file_path: path.join(cwd, ".claude", "skills", "wp-plugin-development", "references", "settings-api.md") } },
    ],
  },
});
fs.appendFileSync(path.join(cwd, "acme-plugin", "src", "Settings.php"), "\n// register_setting edited by fake agent\n");
emit({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "acme-plugin/src/Settings.php" } }] } });
emit({ type: "result", subtype: "success", is_error: false, result: "Added the setting.", total_cost_usd: 0.05, duration_ms: 1234, num_turns: 3 });
