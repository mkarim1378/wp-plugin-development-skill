import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Copies the skills in ./skills into an agent's skills directory.
//
//   node scripts/install.mjs                       # ~/.claude/skills (global)
//   node scripts/install.mjs --project <repo>      # <repo>/.claude/skills
//   node scripts/install.mjs --target <dir>        # any skills directory (e.g. ~/.cursor/skills)
//   node scripts/install.mjs --skills wp-plugin-development,wp-project-triage
//   node scripts/install.mjs --force               # replace skills that already exist
//   node scripts/install.mjs --dry-run

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "skills");
const IGNORED_NAMES = new Set([".omc", ".DS_Store", "Thumbs.db", ".git"]);

function parseArgs(argv) {
  const opts = { target: null, skills: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--global") opts.target = path.join(os.homedir(), ".claude", "skills");
    else if (arg === "--project") opts.target = path.join(path.resolve(argv[++i] ?? "."), ".claude", "skills");
    else if (arg === "--target") opts.target = path.resolve(argv[++i] ?? "");
    else if (arg === "--skills") opts.skills = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--force") opts.force = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  opts.target ??= path.join(os.homedir(), ".claude", "skills");
  return opts;
}

function listSkills() {
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsRoot, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }
  if (opts.help) {
    const usage = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//   "));
    process.stdout.write(`${usage.map((l) => l.slice(2)).join("\n")}\n`);
    return;
  }

  const available = listSkills();
  const selected = opts.skills ?? available;
  const unknown = selected.filter((s) => !available.includes(s));
  if (unknown.length > 0) {
    process.stderr.write(`Unknown skill(s): ${unknown.join(", ")}\nAvailable: ${available.join(", ")}\n`);
    process.exit(2);
  }

  process.stdout.write(`${opts.dryRun ? "[dry run] " : ""}Installing ${selected.length} skill(s) into ${opts.target}\n`);
  if (!opts.dryRun) fs.mkdirSync(opts.target, { recursive: true });

  let installed = 0;
  let skipped = 0;
  for (const name of selected) {
    const src = path.join(skillsRoot, name);
    const dest = path.join(opts.target, name);
    const exists = fs.existsSync(dest);

    if (exists && !opts.force) {
      process.stdout.write(`  skip     ${name} (already installed; use --force to replace)\n`);
      skipped += 1;
      continue;
    }
    process.stdout.write(`  ${exists ? "replace" : "install"}  ${name}\n`);
    if (!opts.dryRun) {
      if (exists) fs.rmSync(dest, { recursive: true, force: true });
      // Skip tooling state; keep template dotfiles such as .gitignore and .wp-env.json.
      fs.cpSync(src, dest, { recursive: true, filter: (p) => !IGNORED_NAMES.has(path.basename(p)) });
    }
    installed += 1;
  }

  process.stdout.write(`Done: ${installed} installed, ${skipped} skipped.\n`);
  if (selected.includes("wp-plugin-development") && !selected.includes("wp-project-triage")) {
    process.stdout.write("Note: wp-plugin-development runs wp-project-triage's script; install it too.\n");
  }
}

main();
