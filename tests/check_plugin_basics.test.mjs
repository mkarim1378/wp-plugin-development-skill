import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "..", "skills", "wp-plugin-development", "scripts", "check_plugin_basics.mjs");
const fixture = (name) => path.join(here, "fixtures", name);

function run(dir, ...args) {
  const out = spawnSync(process.execPath, [script, dir, ...args], { encoding: "utf8" });
  return { status: out.status, report: out.stdout ? JSON.parse(out.stdout) : null, stderr: out.stderr };
}

function ids(report) {
  return report.findings.map((f) => `${f.id}@${f.file}:${f.line}`);
}

test("clean plugin has no findings", () => {
  const { status, report } = run(fixture("good-plugin"));
  assert.equal(status, 0);
  assert.deepEqual(report.summary, { error: 0, warning: 0, info: 0 });
  assert.equal(report.mainFile, "good-plugin.php");
  assert.deepEqual(report.textDomains, { "good-plugin": 2 });
});

test("bad plugin reports the expected problems", () => {
  const { report } = run(fixture("bad-plugin"));
  const found = ids(report);
  const expected = [
    "readme-stable-tag-mismatch@readme.txt:1",
    "header-text-domain-slug@bad-plugin.php:1",
    "input-raw-superglobal@bad-plugin.php:7",
    "output-unescaped@bad-plugin.php:8",
    "sql-unprepared@bad-plugin.php:15",
    "sql-quoted-placeholder@bad-plugin.php:16",
    "input-dangerous-call@bad-plugin.php:18",
    "http-sslverify-disabled@bad-plugin.php:19",
    "i18n-missing-text-domain@bad-plugin.php:12",
    "i18n-non-literal-text-domain@bad-plugin.php:13",
    "i18n-variable-string@bad-plugin.php:11",
    "csrf-no-nonce-check@bad-plugin.php:1",
    "dangerous-function@includes/helper.php:3",
    "trailing-whitespace-after-close-tag@includes/helper.php:4",
    "uninstall-missing@.:0",
  ];
  for (const id of expected) assert.ok(found.includes(id), `missing ${id}`);

  // Lines that are fine must not be flagged.
  assert.ok(!found.some((f) => f.startsWith("sql-") && f.endsWith(":17")), "constant-only query flagged");
  assert.ok(!found.some((f) => f.endsWith("bad-plugin.php:22")), "sanitized superglobal flagged");
  assert.equal(report.suppressedByPhpcsIgnore, 1);
});

test("--strict exits non-zero when errors exist", () => {
  assert.equal(run(fixture("bad-plugin"), "--strict").status, 1);
  assert.equal(run(fixture("good-plugin"), "--strict").status, 0);
});

test("CRLF files: prepared query variables are recognized", () => {
  const { report } = run(fixture("crlf-plugin"));
  const found = ids(report);
  assert.ok(!found.includes("sql-unverified-variable@crlf-plugin.php:16"), "prepared $sql flagged");
  assert.ok(found.includes("sql-unverified-variable@crlf-plugin.php:17"));
  assert.equal(report.summary.error, 0);
});

test("call-level rules: REST, AJAX, rewrites, textdomain, autoload, uploads", () => {
  const { report } = run(fixture("rules-plugin"));
  assert.deepEqual(ids(report).sort(), [
    "ajax-nopriv-handler@rules-plugin.php:36",
    "i18n-textdomain-before-init@rules-plugin.php:46",
    "option-forced-autoload@rules-plugin.php:53",
    "rest-missing-permission-callback@rules-plugin.php:16",
    "rewrite-flush-on-request@rules-plugin.php:38",
    "upload-move-uploaded-file@rules-plugin.php:59",
    "upload-without-wp-handler@rules-plugin.php:58",
  ]);
});

test("--format sarif emits SARIF 2.1.0 with prefixed URIs", () => {
  const { report: sarif } = run(fixture("rules-plugin"), "--format", "sarif", "--uri-prefix", "plugins/rules");
  assert.equal(sarif.version, "2.1.0");
  const results = sarif.runs[0].results;
  assert.equal(results.length, 7);
  assert.ok(results.every((r) => r.locations[0].physicalLocation.artifactLocation.uri.startsWith("plugins/rules/")));
  assert.ok(results.every((r) => ["error", "warning", "note"].includes(r.level)));
  const ruleIds = sarif.runs[0].tool.driver.rules.map((r) => r.id);
  assert.ok(ruleIds.includes("rest-missing-permission-callback"));
});

test("non-directory argument exits with 2", () => {
  assert.equal(run(path.join(here, "does-not-exist")).status, 2);
});
