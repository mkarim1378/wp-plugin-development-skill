import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseJudgeOutput, summarizeTranscript } from "../scripts/run-evals.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, "..", "scripts", "run-evals.mjs");
const fake = path.join(here, "fixtures", "fake-claude.mjs");

function runEvals(args, env = {}) {
  return spawnSync(process.execPath, [runner, ...args], {
    encoding: "utf8",
    env: { ...process.env, EVAL_CLAUDE_CMD: JSON.stringify([process.execPath, fake]), ...env },
  });
}

test("summarizeTranscript extracts skills, references, tools and cost", () => {
  const lines = [
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "wp-rest-api" } }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "C:\\ws\\.claude\\skills\\wp-plugin-development\\references\\security.md" } }] } }),
    "not json",
    JSON.stringify({ type: "result", is_error: false, result: "done", total_cost_usd: 0.2, duration_ms: 10, num_turns: 2 }),
  ];
  const s = summarizeTranscript(lines);
  assert.deepEqual(s.skillsUsed, ["wp-plugin-development", "wp-rest-api"]);
  assert.deepEqual(s.referencesRead, ["wp-plugin-development/references/security.md"]);
  assert.equal(s.toolCalls.length, 2);
  assert.equal(s.costUsd, 0.2);
  assert.equal(s.isError, false);
  assert.equal(summarizeTranscript([]).isError, true);
});

test("parseJudgeOutput accepts structured_output or JSON text", () => {
  const verdict = { criteria: [], expected_steps: [], summary: "x" };
  assert.deepEqual(parseJudgeOutput(JSON.stringify({ structured_output: verdict })), verdict);
  assert.deepEqual(parseJudgeOutput(JSON.stringify({ result: "```json\n" + JSON.stringify(verdict) + "\n```" })), verdict);
  assert.throws(() => parseJudgeOutput(JSON.stringify({ is_error: true, result: "boom" })), /judge error/);
});

test("--list and --dry-run do not call the CLI", () => {
  const out = runEvals(["--dry-run", "--skill", "wp-elementor-addon"], { EVAL_CLAUDE_CMD: JSON.stringify(["does-not-exist"]) });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /elementor-new-widget/);
  assert.match(out.stdout, /would spend up to/);
});

test("end-to-end with a fake CLI writes a graded report", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpskill-evals-"));
  const out = runEvals(["--scenario", "plugin-add-settings-page", "--out", outDir]);
  assert.equal(out.status, 0, out.stdout + out.stderr);

  const [run] = fs.readdirSync(outDir);
  const report = JSON.parse(fs.readFileSync(path.join(outDir, run, "report.json"), "utf8"));
  assert.equal(report.results.length, 1);
  const r = report.results[0];
  assert.equal(r.id, "plugin-add-settings-page");
  assert.equal(r.passed, 1);
  assert.equal(r.total, 2);
  assert.deepEqual(r.skillsUsed, ["wp-plugin-development"]);
  assert.deepEqual(r.referencesRead, ["wp-plugin-development/references/settings-api.md"]);
  assert.ok(Math.abs(r.costUsd - 0.06) < 1e-9);

  const diff = fs.readFileSync(path.join(outDir, run, "plugin-add-settings-page.diff"), "utf8");
  assert.match(diff, /edited by fake agent/);
  assert.doesNotMatch(diff, /\.claude\/skills/);
  assert.match(fs.readFileSync(path.join(outDir, run, "report.md"), "utf8"), /Nonce is present/);
});

test("unauthenticated CLI stops the run with a clear message", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpskill-evals-"));
  const out = runEvals(["--skill", "wp-plugin-development", "--out", outDir], { FAKE_CLAUDE_MODE: "auth-error" });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /not authenticated/);
  const [run] = fs.readdirSync(outDir);
  const report = JSON.parse(fs.readFileSync(path.join(outDir, run, "report.json"), "utf8"));
  assert.equal(report.results.length, 1, "stops after the first auth failure");
});
