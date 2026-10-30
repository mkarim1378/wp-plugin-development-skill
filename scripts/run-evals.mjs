import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs eval scenarios against the skills with Claude Code in headless mode, then grades each run
// with a judge model against the scenario's expected_behavior and success_criteria.
//
//   node scripts/run-evals.mjs --list
//   node scripts/run-evals.mjs --scenario plugin-add-settings-page
//   node scripts/run-evals.mjs --skill wp-woocommerce-extension --model sonnet --judge-model opus
//   node scripts/run-evals.mjs --dry-run
//
// Options: --skill <name> | --scenario <substring> (repeatable filters), --model <m>, --judge-model <m>,
//   --budget <usd per scenario, default 2>, --timeout <seconds per scenario, default 900>,
//   --out <dir, default eval/results>, --keep (keep workspaces), --dry-run, --list, --min-score <0..1>.
// Env: EVAL_CLAUDE_CMD='["claude"]' (JSON array) to use another binary or a test double.
//
// Each scenario runs in a fresh temp workspace: the plugin under test (scenario "fixture" path, or a
// scaffolded plugin with features inferred from the scenario's skills) plus all skills installed in
// .claude/skills. Requires an authenticated `claude` CLI; every run costs API usage.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenariosDir = path.join(repoRoot, "eval", "scenarios");
const scaffold = path.join(repoRoot, "skills", "wp-plugin-development", "scripts", "scaffold_plugin.mjs");
const installer = path.join(repoRoot, "scripts", "install.mjs");

const AGENT_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep", "Skill", "Bash(node:*)", "Bash(php:*)", "Bash(git:*)", "Bash(ls:*)"];
const FEATURES_BY_SKILL = { "wp-woocommerce-extension": "woocommerce", "wp-elementor-addon": "elementor" };
const MAX_DIFF_CHARS = 40000;

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: { criterion: { type: "string" }, pass: { type: "boolean" }, evidence: { type: "string" } },
        required: ["criterion", "pass", "evidence"],
      },
    },
    expected_steps: {
      type: "array",
      items: {
        type: "object",
        properties: { step: { type: "string" }, observed: { type: "boolean" }, note: { type: "string" } },
        required: ["step", "observed"],
      },
    },
    summary: { type: "string" },
  },
  required: ["criteria", "expected_steps", "summary"],
};

function parseArgs(argv) {
  const opts = { skills: [], scenarios: [], budget: "2", timeout: 900, out: path.join(repoRoot, "eval", "results") };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    if (a === "--skill") opts.skills.push(next());
    else if (a === "--scenario") opts.scenarios.push(next());
    else if (a === "--model") opts.model = next();
    else if (a === "--judge-model") opts.judgeModel = next();
    else if (a === "--budget") opts.budget = next();
    else if (a === "--timeout") opts.timeout = Number(next());
    else if (a === "--out") opts.out = path.resolve(next());
    else if (a === "--min-score") opts.minScore = Number(next());
    else if (a === "--keep") opts.keep = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--list") opts.list = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function claudeCommand() {
  const raw = process.env.EVAL_CLAUDE_CMD;
  if (!raw) return ["claude"];
  const cmd = JSON.parse(raw);
  if (!Array.isArray(cmd) || cmd.length === 0) throw new Error("EVAL_CLAUDE_CMD must be a non-empty JSON array");
  return cmd;
}

function loadScenarios(opts) {
  return fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ id: f.replace(/\.json$/, ""), file: f, ...JSON.parse(fs.readFileSync(path.join(scenariosDir, f), "utf8")) }))
    .filter((s) => opts.skills.length === 0 || opts.skills.some((k) => (s.skills || []).includes(k)))
    .filter((s) => opts.scenarios.length === 0 || opts.scenarios.some((q) => s.id.includes(q)));
}

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options });
}

function git(cwd, ...args) {
  return run("git", ["-c", "user.name=eval", "-c", "user.email=eval@localhost", "-c", "core.autocrlf=false", ...args], { cwd });
}

// Builds the workspace: plugin under test + installed skills, committed as the baseline.
function prepareWorkspace(scenario) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), `wpskill-eval-${scenario.id.slice(0, 20)}-`));
  const pluginDir = path.join(ws, "acme-plugin");

  if (scenario.fixture) {
    fs.cpSync(path.join(repoRoot, scenario.fixture), pluginDir, { recursive: true });
  } else {
    const features = [...new Set((scenario.features || []).concat((scenario.skills || []).map((s) => FEATURES_BY_SKILL[s]).filter(Boolean)))];
    const out = run(process.execPath, [scaffold, "--slug", "acme-plugin", "--name", "Acme Plugin", "--dest", pluginDir, ...features.map((f) => `--${f}`)]);
    if (out.status !== 0) throw new Error(`scaffold failed: ${out.stderr}`);
  }

  const inst = run(process.execPath, [installer, "--project", ws]);
  if (inst.status !== 0) throw new Error(`skill install failed: ${inst.stderr}`);

  git(ws, "init", "-q");
  git(ws, "add", "-A");
  git(ws, "commit", "-q", "-m", "baseline");
  return { ws, pluginDir };
}

// On Windows the CLI's hook processes can hold the directory briefly after exit; retry, then leave it.
function removeWorkspace(ws) {
  try {
    fs.rmSync(ws, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch (err) {
    process.stdout.write(`  could not remove workspace (${err.code}): ${ws}\n`);
  }
}

// Summarizes stream-json events into what the judge needs.
export function summarizeTranscript(lines) {
  const toolCalls = [];
  const skillsUsed = new Set();
  const referencesRead = new Set();
  let result = null;

  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "assistant" && Array.isArray(event.message?.content)) {
      for (const part of event.message.content) {
        if (part.type !== "tool_use") continue;
        const input = part.input || {};
        const summary = input.command || input.file_path || input.path || input.pattern || input.skill || JSON.stringify(input).slice(0, 200);
        toolCalls.push(`${part.name}: ${String(summary).slice(0, 300)}`);
        if (part.name === "Skill" && input.skill) skillsUsed.add(String(input.skill));
        const p = String(input.file_path || input.path || "").replace(/\\/g, "/");
        const m = p.match(/\.claude\/skills\/([^/]+)\/(.+)$/);
        if (m) {
          skillsUsed.add(m[1]);
          if (m[2].startsWith("references/")) referencesRead.add(`${m[1]}/${m[2]}`);
        }
      }
    }
    if (event.type === "result") result = event;
  }

  return {
    toolCalls,
    skillsUsed: [...skillsUsed].sort(),
    referencesRead: [...referencesRead].sort(),
    finalText: result?.result ?? "",
    isError: Boolean(result?.is_error) || !result,
    costUsd: Number(result?.total_cost_usd || 0),
    durationMs: Number(result?.duration_ms || 0),
    turns: Number(result?.num_turns || 0),
  };
}

function runAgent(scenario, ws, opts) {
  const [bin, ...pre] = claudeCommand();
  const prompt = `${scenario.query}\n\nThe WordPress plugin is in ./acme-plugin (relative to the current directory).`;
  const args = [
    ...pre,
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    AGENT_TOOLS.join(","),
    "--max-budget-usd",
    String(opts.budget),
    ...(opts.model ? ["--model", opts.model] : []),
  ];
  const out = run(bin, args, { cwd: ws, timeout: opts.timeout * 1000 });
  const lines = (out.stdout || "").split(/\r?\n/).filter(Boolean);
  const summary = summarizeTranscript(lines);
  if (out.error) summary.runnerError = String(out.error.message || out.error);
  return { summary, lines };
}

function collectChanges(ws) {
  git(ws, "add", "-A");
  const stat = git(ws, "diff", "--cached", "--stat", "--", ".", ":(exclude).claude").stdout.trim();
  let diff = git(ws, "diff", "--cached", "--", ".", ":(exclude).claude").stdout;
  if (diff.length > MAX_DIFF_CHARS) diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n... [diff truncated]`;
  return { stat, diff };
}

function judgePrompt(scenario, agent, changes) {
  return [
    "You are grading an AI coding agent that used WordPress development skills to complete a task.",
    "Grade strictly from the evidence below. A criterion passes only if the evidence clearly shows it. If the agent only described changes without making them where the task required code, those criteria fail.",
    "",
    `## Task given to the agent\n${scenario.query}`,
    `## Expected behavior\n${(scenario.expected_behavior || []).map((s) => `- ${s}`).join("\n")}`,
    `## Success criteria\n${(scenario.success_criteria || []).map((s) => `- ${s}`).join("\n")}`,
    `## Skills the agent loaded\n${agent.skillsUsed.join(", ") || "(none)"}`,
    `## Skill references the agent read\n${agent.referencesRead.join(", ") || "(none)"}`,
    `## Tool calls (in order)\n${agent.toolCalls.map((c, i) => `${i + 1}. ${c}`).join("\n") || "(none)"}`,
    `## Agent's final message\n${agent.finalText || "(empty)"}`,
    `## Changes to the workspace\n${changes.stat || "(no changes)"}\n\n\`\`\`diff\n${changes.diff}\n\`\`\``,
    "",
    "Return one entry per success criterion (same wording) and one entry per expected step.",
  ].join("\n\n");
}

export function parseJudgeOutput(stdout) {
  const result = JSON.parse(stdout);
  if (result.is_error) throw new Error(`judge error: ${result.result}`);
  if (result.structured_output && typeof result.structured_output === "object") return result.structured_output;
  const text = String(result.result || "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(text);
}

function runJudge(scenario, agent, changes, opts) {
  const [bin, ...pre] = claudeCommand();
  const args = [
    ...pre,
    "-p",
    judgePrompt(scenario, agent, changes),
    "--tools",
    "",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(JUDGE_SCHEMA),
    "--no-session-persistence",
    "--max-budget-usd",
    "1",
    ...(opts.judgeModel ? ["--model", opts.judgeModel] : []),
  ];
  const out = run(bin, args, { cwd: os.tmpdir(), timeout: 300000 });
  const verdict = parseJudgeOutput(out.stdout || "{}");
  const cost = (() => {
    try {
      return Number(JSON.parse(out.stdout).total_cost_usd || 0);
    } catch {
      return 0;
    }
  })();
  return { verdict, cost };
}

function markdownReport(report) {
  const rows = report.results.map((r) =>
    r.error
      ? `| ${r.id} | error | – | – | ${r.error.replace(/\|/g, "\\|").slice(0, 120)} |`
      : `| ${r.id} | ${(r.score * 100).toFixed(0)}% | ${r.passed}/${r.total} | $${r.costUsd.toFixed(2)} | ${r.skillsUsed.join(", ")} |`
  );
  const failures = report.results
    .filter((r) => !r.error && r.passed < r.total)
    .map((r) => `### ${r.id}\n\n${r.verdict.criteria.filter((c) => !c.pass).map((c) => `- ✗ ${c.criterion} — ${c.evidence}`).join("\n")}\n\n${r.verdict.summary}`);
  return [
    `# Eval report ${report.startedAt}`,
    "",
    `Scenarios: ${report.results.length} · Mean score: ${(report.meanScore * 100).toFixed(0)}% · Cost: $${report.totalCostUsd.toFixed(2)}`,
    "",
    "| Scenario | Score | Criteria | Cost | Skills used |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    failures.length ? "## Failed criteria\n" : "",
    ...failures,
    "",
  ].join("\n");
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }

  const scenarios = loadScenarios(opts);
  if (opts.list || opts.dryRun) {
    for (const s of scenarios) process.stdout.write(`${s.id}\t[${(s.skills || []).join(", ")}]\t${s.query.slice(0, 90)}\n`);
    process.stdout.write(`${scenarios.length} scenario(s)${opts.dryRun ? `; would spend up to $${(Number(opts.budget) + 1) * scenarios.length} (agent budget + judge per scenario)` : ""}.\n`);
    return;
  }
  if (scenarios.length === 0) {
    process.stderr.write("No scenarios matched.\n");
    process.exit(2);
  }

  const startedAt = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(opts.out, startedAt);
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];

  for (const scenario of scenarios) {
    process.stdout.write(`▶ ${scenario.id} ... `);
    let ws;
    try {
      ({ ws } = prepareWorkspace(scenario));
      const { summary, lines } = runAgent(scenario, ws, opts);
      fs.writeFileSync(path.join(outDir, `${scenario.id}.transcript.jsonl`), `${lines.join("\n")}\n`);
      if (summary.isError) {
        const reason = summary.runnerError || summary.finalText || "agent run failed";
        results.push({ id: scenario.id, error: reason, costUsd: summary.costUsd });
        process.stdout.write(`error: ${reason.slice(0, 160)}\n`);
        if (/authenticat|OAuth|401|login/i.test(reason)) {
          process.stderr.write("Claude CLI is not authenticated. Run `claude auth login` (or /login in an interactive session) and retry.\n");
          break;
        }
        continue;
      }
      const changes = collectChanges(ws);
      fs.writeFileSync(path.join(outDir, `${scenario.id}.diff`), changes.diff);
      const { verdict, cost } = runJudge(scenario, summary, changes, opts);
      const total = verdict.criteria.length;
      const passed = verdict.criteria.filter((c) => c.pass).length;
      const result = {
        id: scenario.id,
        skills: scenario.skills,
        score: total ? passed / total : 0,
        passed,
        total,
        costUsd: summary.costUsd + cost,
        durationMs: summary.durationMs,
        turns: summary.turns,
        skillsUsed: summary.skillsUsed,
        referencesRead: summary.referencesRead,
        verdict,
      };
      results.push(result);
      process.stdout.write(`${passed}/${total} ($${result.costUsd.toFixed(2)})\n`);
    } catch (err) {
      results.push({ id: scenario.id, error: String(err.message || err), costUsd: 0 });
      process.stdout.write(`error: ${err.message}\n`);
    } finally {
      if (ws && !opts.keep) removeWorkspace(ws);
      else if (ws) process.stdout.write(`  workspace kept: ${ws}\n`);
    }
  }

  const graded = results.filter((r) => !r.error);
  const report = {
    startedAt,
    model: opts.model ?? "default",
    judgeModel: opts.judgeModel ?? "default",
    meanScore: graded.length ? graded.reduce((a, r) => a + r.score, 0) / graded.length : 0,
    totalCostUsd: results.reduce((a, r) => a + (r.costUsd || 0), 0),
    results,
  };
  fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "report.md"), markdownReport(report));
  process.stdout.write(`\nReport: ${path.join(outDir, "report.md")}\n`);

  const errored = results.some((r) => r.error);
  const belowMin = opts.minScore !== undefined && report.meanScore < opts.minScore;
  if (errored || belowMin) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
