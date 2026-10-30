import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compares the bundled skills with WordPress/agent-skills on GitHub.
//
//   node scripts/upstream-diff.mjs              # compare with upstream trunk
//   node scripts/upstream-diff.mjs --ref <sha>  # compare with a specific commit (e.g. the pinned one)
//
// Set GITHUB_TOKEN to avoid the unauthenticated API rate limit.
// Files are compared by git blob hash after normalizing line endings to LF.

const UPSTREAM_REPO = "WordPress/agent-skills";
const LOCALLY_DEVELOPED = new Set(["wp-plugin-development"]);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function gitBlobSha(buffer) {
  const text = buffer.toString("utf8").replace(/\r\n/g, "\n");
  const body = Buffer.from(text, "utf8");
  return crypto.createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}

function listLocalFiles(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".omc") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listLocalFiles(full, base));
    else if (ent.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

async function fetchJson(url) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "wp-plugin-development-skill" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const refIndex = process.argv.indexOf("--ref");
  const ref = refIndex !== -1 ? process.argv[refIndex + 1] : "trunk";

  const commit = await fetchJson(`https://api.github.com/repos/${UPSTREAM_REPO}/commits/${ref}`);
  const tree = await fetchJson(`https://api.github.com/repos/${UPSTREAM_REPO}/git/trees/${commit.sha}?recursive=1`);

  const upstream = new Map(); // "skill/relpath" -> sha
  const upstreamSkills = new Set();
  for (const item of tree.tree) {
    const m = item.type === "blob" && item.path.match(/^skills\/([^/]+)\/(.+)$/);
    if (!m) continue;
    upstreamSkills.add(m[1]);
    upstream.set(`${m[1]}/${m[2]}`, item.sha);
  }

  const localSkills = fs
    .readdirSync(path.join(repoRoot, "skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  const report = { upstream: UPSTREAM_REPO, ref, commit: commit.sha, date: commit.commit.committer.date, skills: {}, notBundled: [] };

  for (const skill of localSkills) {
    const dir = path.join(repoRoot, "skills", skill);
    const entry = { locallyDeveloped: LOCALLY_DEVELOPED.has(skill), changed: [], localOnly: [], upstreamOnly: [] };

    if (!upstreamSkills.has(skill)) {
      entry.note = "not present upstream";
      report.skills[skill] = entry;
      continue;
    }

    const localFiles = listLocalFiles(dir);
    for (const rel of localFiles) {
      const upstreamSha = upstream.get(`${skill}/${rel}`);
      if (!upstreamSha) entry.localOnly.push(rel);
      else if (upstreamSha !== gitBlobSha(fs.readFileSync(path.join(dir, rel)))) entry.changed.push(rel);
    }
    for (const key of upstream.keys()) {
      if (!key.startsWith(`${skill}/`)) continue;
      const rel = key.slice(skill.length + 1);
      if (!localFiles.includes(rel)) entry.upstreamOnly.push(rel);
    }
    report.skills[skill] = entry;
  }

  report.notBundled = [...upstreamSkills].filter((s) => !localSkills.includes(s)).sort();

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
