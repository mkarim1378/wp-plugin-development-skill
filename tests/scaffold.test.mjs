import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { render } from "../skills/wp-plugin-development/scripts/scaffold_plugin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.join(here, "..", "skills", "wp-plugin-development", "scripts");
const scaffold = path.join(scriptsDir, "scaffold_plugin.mjs");
const check = path.join(scriptsDir, "check_plugin_basics.mjs");
const hasPhp = spawnSync("php", ["-v"], { encoding: "utf8" }).status === 0;

// Feature combinations to generate; later phases add overlays that make more combinations valid.
const overlaysDir = path.join(here, "..", "skills", "wp-plugin-development", "assets", "overlays");
const availableFeatures = fs.existsSync(overlaysDir) ? fs.readdirSync(overlaysDir) : [];
const variants = [[], ...availableFeatures.map((f) => [f]), availableFeatures].filter(
  (v, i, all) => all.findIndex((o) => o.join() === v.join()) === i
);

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wpskill-scaffold-"));
}

function node(args) {
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

function listFiles(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath ?? e.path, e.name));
}

test("render handles values, sections, inverted sections and standalone tags", () => {
  const ctx = { a: "X", on: true, off: false };
  assert.equal(render("v={{a}}", ctx), "v=X");
  assert.equal(render("{{#on}}yes{{/on}}{{#off}}no{{/off}}{{^off}}!{{/off}}", ctx), "yes!");
  assert.equal(render("1\n{{#off}}\nhidden\n{{/off}}\n2\n", ctx), "1\n2\n");
  assert.equal(render("${{ matrix.php }}", ctx), "${{ matrix.php }}");
  assert.throws(() => render("{{missing}}", ctx), /unknown placeholder/);
  assert.equal(render("{{WRAPPER}} .x { color: {{VALUE}}; }", ctx), "{{WRAPPER}} .x { color: {{VALUE}}; }");
});

for (const features of variants) {
  const label = features.length ? features.join("+") : "base";

  test(`scaffold (${label}) produces a plugin with no findings`, () => {
    const dest = path.join(tmpDir(), "acme-reviews");
    const out = node([scaffold, "--slug", "acme-reviews", "--dest", dest, "--author", "Acme", ...features.map((f) => `--${f}`)]);
    assert.equal(out.status, 0, out.stderr);

    const report = JSON.parse(out.stdout);
    assert.ok(report.files.includes("acme-reviews.php"));

    for (const file of listFiles(dest)) {
      const text = fs.readFileSync(file, "utf8");
      // Elementor selector placeholders ({{WRAPPER}}, {{VALUE}}) are meant to survive.
      const leftovers = (text.match(/\{\{[#^/]?\w+\}\}/g) || []).filter((t) => !/^\{\{[A-Z_]+\}\}$/.test(t) || /PREFIX/.test(t));
      assert.deepEqual(leftovers, [], `${file} has unrendered tags: ${leftovers}`);
    }

    const checked = JSON.parse(node([check, dest]).stdout);
    assert.deepEqual(checked.summary, { error: 0, warning: 0, info: 0 }, JSON.stringify(checked.findings, null, 2));

    for (const file of ["composer.json", "package.json", ".wp-env.json"]) {
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(dest, file), "utf8")), file);
    }

    if (hasPhp) {
      for (const file of listFiles(dest).filter((f) => f.endsWith(".php"))) {
        const lint = spawnSync("php", ["-l", file], { encoding: "utf8" });
        assert.equal(lint.status, 0, lint.stdout + lint.stderr);
      }
    }
  });
}

test("scaffold refuses a non-empty destination and bad input", () => {
  const dest = tmpDir();
  fs.writeFileSync(path.join(dest, "keep.txt"), "x");
  assert.equal(node([scaffold, "--slug", "acme-reviews", "--dest", dest]).status, 2);
  assert.equal(node([scaffold, "--slug", "Bad Slug"]).status, 2);
  assert.equal(node([scaffold, "--slug", "acme-reviews", "--name", "Acme's"]).status, 2);
  assert.equal(node([scaffold, "--slug", "acme-reviews", "--prefix", "wp_acme"]).status, 2);
});

test("--dry-run writes nothing", () => {
  const dest = path.join(tmpDir(), "dry");
  const out = node([scaffold, "--slug", "acme-reviews", "--dest", dest, "--dry-run"]);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(fs.existsSync(dest), false);
});
