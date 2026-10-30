import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { assess, parseCallback } from "../skills/wp-plugin-development/scripts/list_entry_points.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "..", "skills", "wp-plugin-development", "scripts", "list_entry_points.mjs");
const fixture = path.join(here, "fixtures", "entry-points-plugin");

function run(...args) {
  return spawnSync(process.execPath, [script, fixture, ...args], { encoding: "utf8" });
}

test("parseCallback handles strings, arrays, static methods and closures", () => {
  assert.deepEqual(parseCallback("'acme_cb'"), { type: "function", name: "acme_cb", label: "acme_cb" });
  assert.equal(parseCallback("'Acme::run'").name, "run");
  assert.equal(parseCallback("array( $this, 'save' )").name, "save");
  assert.equal(parseCallback("[ self::class, 'render' ]").name, "render");
  assert.equal(parseCallback("function () { return 1; }").type, "closure");
  assert.equal(parseCallback("static fn() => 1").type, "closure");
  assert.equal(parseCallback("$callback").type, "unknown");
});

test("assess flags missing checks per entry kind", () => {
  const ajax = { kind: "ajax", public: false, resolved: true, checks: { nonce: false, capability: true, readsInput: true, sanitizes: true, changesState: true } };
  assert.equal(assess(ajax).risk, "high");
  assert.equal(assess({ ...ajax, checks: { ...ajax.checks, nonce: "via-helper" } }).risk, "ok");
  assert.equal(assess({ kind: "rest", permission: "missing", resolved: true, checks: {} }).risk, "high");
  assert.equal(assess({ kind: "rest", permission: "__return_true", resolved: true, checks: {} }).risk, "review");
  assert.equal(assess({ kind: "cron", resolved: true, checks: {} }).risk, "ok");
});

test("fixture: every entry point is found and classified", () => {
  const out = run();
  assert.equal(out.status, 0, out.stderr);
  const report = JSON.parse(out.stdout);
  const byName = Object.fromEntries(report.entries.map((e) => [e.hook || e.route || e.tag || e.page, e]));

  assert.deepEqual(report.summary, { high: 4, review: 4, ok: 3 });
  assert.equal(byName.wp_ajax_ep_delete.risk, "high");
  assert.equal(byName.wp_ajax_ep_safe.risk, "ok");
  assert.equal(byName.wp_ajax_nopriv_ep_track.risk, "review");
  assert.equal(byName.init.kind, "request-handler");
  assert.equal(byName.init.risk, "high");
  assert.equal(byName["/ep/v1/items"].permission, "missing");
  assert.equal(byName["/ep/v1/public"].permission, "__return_true");
  assert.equal(byName["ep-settings"].risk, "high");
  assert.equal(byName.admin_post_ep_export.checks.nonce, "via-helper");
  assert.equal(byName.admin_post_ep_export.risk, "ok");
  assert.equal(byName.ep_daily_cleanup.kind, "cron");
  assert.equal(byName.woocommerce_api_ep_gateway.kind, "wc-api");
  assert.equal(byName.ep_box.kind, "shortcode");
  assert.equal(report.entries[0].risk, "high", "sorted by risk");
});

test("--format md renders a table", () => {
  const out = run("--format", "md");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /\| Risk \| Kind \|/);
  assert.match(out.stdout, /wp_ajax_ep_delete/);
});
