import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findCalls,
  findFunctionBody,
  listPhpFiles,
  literalValue,
  readFileSafe,
  statSafe,
  toPosix,
} from "./lib/php-scan.mjs";

// Lists every way a request can reach a plugin's code (attack surface) and what each handler checks.
// Usage: node list_entry_points.mjs [plugin-dir] [--format json|md]
//
// Entry kinds: ajax, admin-post, rest, shortcode, admin-page, request-handler (init/admin_init/...
// callbacks that read request data), wc-api (woocommerce_api_*), cron. For each, the callback is
// resolved (named function, $this/self/Class method, or closure) and its body is checked for nonce
// verification, capability checks, input reads and sanitization (one hop into $this->/self:: helpers).
// Heuristic: unresolved callbacks and indirect checks need manual review.

const REQUEST_HOOKS = new Set(["init", "admin_init", "wp_loaded", "template_redirect", "parse_request", "wp", "plugins_loaded", "admin_menu"]);
const ADMIN_PAGE_FUNCS = "add_menu_page|add_submenu_page|add_options_page|add_management_page|add_theme_page|add_users_page|add_dashboard_page|add_posts_page|add_pages_page|add_media_page|add_comments_page|add_plugins_page";

const RX = {
  nonce: /\b(check_ajax_referer|check_admin_referer|wp_verify_nonce)\s*\(/,
  capability: /\b(current_user_can|user_can|is_super_admin)\s*\(/,
  input: /\$_(GET|POST|REQUEST|FILES|COOKIE)\b|\$_SERVER\s*\[|->get_(param|params|json_params|body_params|query_params|file_params)\s*\(|\$request\s*\[/,
  postInput: /\$_(POST|REQUEST|FILES)\b|->get_(body_params|json_params|file_params)\s*\(/,
  sanitize: /\b(sanitize_\w+|absint|intval|floatval|wp_kses\w*|rest_sanitize_\w+|filter_var|is_email|wp_unslash)\s*\(|\((int|bool|float)\)/,
  stateChange: /\b(update_option|add_option|delete_option|update_(post|user|term)_meta|delete_(post|user|term)_meta|wp_insert_\w+|wp_update_\w+|wp_delete_\w+|\$wpdb->(insert|update|delete|query)|wp_mail|wp_set_auth_cookie|move_uploaded_file|wp_handle_upload|->save\s*\()/,
};

const CHECK_PATTERNS = { nonce: "nonce", capability: "capability", readsInput: "input", readsPost: "postInput", sanitizes: "sanitize", changesState: "stateChange" };

function parseArgs(argv) {
  const opts = { format: "json", dir: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--format") opts.format = argv[++i];
    else if (!argv[i].startsWith("--")) opts.dir = argv[i];
  }
  return opts;
}

// Turns a PHP callback expression into { method|func|closure } so its body can be found.
export function parseCallback(expr) {
  const e = (expr || "").trim();
  if (/^(static\s+)?function\s*\(|^(static\s+)?fn\s*\(/.test(e)) return { type: "closure", body: e, label: "closure" };
  const lit = literalValue(e);
  if (lit !== null) {
    const parts = lit.split("::");
    return parts.length === 2 ? { type: "method", name: parts[1], label: lit } : { type: "function", name: lit, label: lit };
  }
  const arr = e.match(/^(?:array\s*\(|\[)\s*([^,]+?)\s*,\s*(['"])(\w+)\2\s*(?:\)|\])$/s);
  if (arr) return { type: "method", name: arr[3], label: `${arr[1].trim()}->${arr[3]}` };
  return { type: "unknown", label: e.slice(0, 80) };
}

function analyzeBody(body, fileText, allFiles) {
  const checks = Object.fromEntries(Object.entries(CHECK_PATTERNS).map(([key, rx]) => [key, RX[rx].test(body)]));
  // One hop into helpers called as $this->x() / self::x() / static::x().
  for (const m of body.matchAll(/(?:\$this->|self::|static::)(\w+)\s*\(/g)) {
    const helper = findFunctionBody(fileText, m[1]) || allFiles.map((f) => findFunctionBody(f.text, m[1])).find(Boolean);
    if (!helper) continue;
    for (const [key, rx] of Object.entries(CHECK_PATTERNS)) {
      if (!checks[key] && RX[rx].test(helper.body)) checks[key] = "via-helper";
    }
  }
  return checks;
}

function resolve(callbackExpr, file, allFiles) {
  const cb = parseCallback(callbackExpr);
  if (cb.type === "closure") return { label: "closure", resolved: true, at: null, checks: analyzeBody(cb.body, file.text, allFiles) };
  if (cb.type === "unknown") return { label: cb.label, resolved: false, at: null, checks: null };
  const own = findFunctionBody(file.text, cb.name);
  const hit = own ? { file, fn: own } : allFiles.map((f) => ({ file: f, fn: findFunctionBody(f.text, cb.name) })).find((x) => x.fn);
  if (!hit) return { label: cb.label, resolved: false, at: null, checks: null };
  return { label: cb.label, resolved: true, at: `${hit.file.rel}:${hit.fn.line}`, checks: analyzeBody(hit.fn.body, hit.file.text, allFiles) };
}

// Risk: "high" = missing a check this kind of entry requires; "review" = public or unresolved; "ok" otherwise.
export function assess(entry) {
  const c = entry.checks;
  const notes = [];
  let risk = "ok";
  const raise = (level, note) => {
    notes.push(note);
    if (level === "high" || (level === "review" && risk === "ok")) risk = level;
  };

  if (!entry.resolved) raise("review", "callback not resolved; review manually");

  switch (entry.kind) {
    case "ajax":
    case "admin-post":
      if (entry.public) {
        raise("review", "public (nopriv) handler: treat input as attacker-controlled, rate limit, return only public data");
        if (c && c.changesState && !c.nonce) raise("review", "changes state without a nonce");
      } else if (c) {
        if (!c.nonce) raise("high", "no nonce verification (CSRF)");
        if (!c.capability) raise("high", "no capability check (any logged-in user, including subscribers, can call it)");
      }
      break;
    case "rest":
      if (entry.permission === "missing") raise("high", "no permission_callback");
      else if (entry.permission === "__return_true") raise("review", "public route (__return_true): must not expose private data or change state");
      break;
    case "admin-page":
      if (c && c.readsPost && c.changesState && !c.nonce) raise("high", "page callback handles a POST form without a nonce");
      if (entry.capability === "read" || entry.capability === "exist") raise("review", `page capability "${entry.capability}" is available to every logged-in user`);
      break;
    case "request-handler":
      if (c && c.changesState && !(c.nonce && c.capability)) raise("high", "changes state on a request hook without nonce + capability checks");
      else raise("review", "reads request data on every request; confirm it is safe for anonymous visitors");
      break;
    case "shortcode":
      raise("review", "attributes come from post authors and render for visitors: escape output");
      if (c && c.readsInput) raise("review", "reads request data while rendering");
      break;
    case "wc-api":
      raise("review", "public callback (e.g. payment gateway): verify with the provider server-side and make it idempotent");
      break;
    default:
      break;
  }
  if (c && c.readsInput && !c.sanitizes && entry.kind !== "rest") raise("review", "reads input without visible sanitization");
  return { risk, notes };
}

function scan(pluginDir) {
  const { results } = listPhpFiles(pluginDir);
  const files = results
    .map((p) => ({ path: p, rel: toPosix(path.relative(pluginDir, p)), text: readFileSafe(p) }))
    .filter((f) => f.text !== null);

  const scheduled = new Set();
  for (const f of files) {
    for (const call of findCalls(f.text, "wp_schedule_event|wp_schedule_single_event|as_schedule_single_action|as_schedule_recurring_action|as_enqueue_async_action|as_schedule_cron_action")) {
      const hookArg = /^wp_schedule_event$/.test(call.name) ? call.args[2] : /^wp_schedule_single_event$/.test(call.name) ? call.args[1] : call.name === "as_enqueue_async_action" ? call.args[0] : call.args[call.name === "as_schedule_single_action" ? 1 : 2];
      const hook = literalValue(hookArg);
      if (hook) scheduled.add(hook);
    }
  }

  const entries = [];
  const push = (base, callbackExpr, file) => {
    const r = resolve(callbackExpr, file, files);
    const entry = { ...base, file: file.rel, callback: r.label, resolved: r.resolved, definedAt: r.at, checks: r.checks };
    entries.push({ ...entry, ...assess(entry) });
  };

  for (const f of files) {
    for (const call of findCalls(f.text, "add_action|add_filter")) {
      const hook = literalValue(call.args[0]);
      const cbExpr = call.args[1];
      if (hook === null) {
        if (/wp_ajax_|admin_post_/.test(call.args[0] || "")) {
          entries.push({ kind: "dynamic-hook", hook: call.args[0], file: f.rel, line: call.line, callback: (cbExpr || "").slice(0, 80), resolved: false, risk: "review", notes: ["hook name built at runtime; list the concrete actions manually"] });
        }
        continue;
      }
      let m;
      if ((m = hook.match(/^wp_ajax_(nopriv_)?(.+)$/))) push({ kind: "ajax", hook, action: m[2], public: Boolean(m[1]), line: call.line }, cbExpr, f);
      else if ((m = hook.match(/^admin_post_(nopriv_)?(.+)$/))) push({ kind: "admin-post", hook, action: m[2], public: Boolean(m[1]), line: call.line }, cbExpr, f);
      else if (/^woocommerce_api_/.test(hook)) push({ kind: "wc-api", hook, public: true, line: call.line }, cbExpr, f);
      else if (scheduled.has(hook)) push({ kind: "cron", hook, public: false, line: call.line }, cbExpr, f);
      else if (REQUEST_HOOKS.has(hook)) {
        const r = resolve(cbExpr, f, files);
        if (r.checks && r.checks.readsInput) {
          const entry = { kind: "request-handler", hook, public: true, line: call.line, file: f.rel, callback: r.label, resolved: r.resolved, definedAt: r.at, checks: r.checks };
          entries.push({ ...entry, ...assess(entry) });
        }
      }
    }

    for (const call of findCalls(f.text, "register_rest_route")) {
      const ns = literalValue(call.args[0]) ?? call.args[0];
      const route = literalValue(call.args[1]) ?? call.args[1];
      const argsText = call.args.slice(2).join(", ");
      const perms = [...argsText.matchAll(/['"]permission_callback['"]\s*=>\s*([^,\n]+(?:\([^)]*\))?)/g)].map((x) => x[1].trim().replace(/,$/, ""));
      const callbacks = [...argsText.matchAll(/['"]callback['"]\s*=>\s*((?:array\s*\([^)]*\)|\[[^\]]*\]|['"][^'"]+['"]))/g)].map((x) => x[1]);
      const methods = [...argsText.matchAll(/['"]methods['"]\s*=>\s*([^,\n]+)/g)].map((x) => x[1].trim());
      const permission = perms.length === 0 ? (argsText.includes("=>") ? "missing" : "unknown") : perms.some((p) => /__return_true/.test(p)) ? "__return_true" : perms.join(" | ");
      push({ kind: "rest", route: `/${ns}${route}`.replace(/\/+/g, "/"), methods: methods.join(" | ") || "GET", permission, public: permission === "__return_true", line: call.line }, callbacks[0] || "", f);
    }

    for (const call of findCalls(f.text, "add_shortcode")) {
      push({ kind: "shortcode", tag: literalValue(call.args[0]) ?? call.args[0], public: true, line: call.line }, call.args[1], f);
    }

    for (const call of findCalls(f.text, ADMIN_PAGE_FUNCS)) {
      const isSub = call.name === "add_submenu_page";
      const capability = literalValue(call.args[isSub ? 3 : 2]) ?? call.args[isSub ? 3 : 2];
      const slug = literalValue(call.args[isSub ? 4 : 3]) ?? call.args[isSub ? 4 : 3];
      const cb = call.args[isSub ? 5 : 4];
      if (!cb) continue;
      push({ kind: "admin-page", page: slug, capability, public: false, line: call.line }, cb, f);
    }
  }

  entries.sort((a, b) => ["high", "review", "ok"].indexOf(a.risk) - ["high", "review", "ok"].indexOf(b.risk) || a.file.localeCompare(b.file) || a.line - b.line);
  return { files: files.length, entries };
}

function toMarkdown(report) {
  const name = (e) => e.hook || e.route || e.tag || e.page || "";
  const flag = (v) => (v === true ? "✓" : v === "via-helper" ? "helper" : v === false ? "✗" : "?");
  const rows = report.entries.map(
    (e) =>
      `| ${e.risk} | ${e.kind} | \`${name(e)}\` | ${e.file}:${e.line} | ${e.callback} | ${e.checks ? flag(e.checks.nonce) : "?"} | ${e.checks ? flag(e.checks.capability) : "?"} | ${e.kind === "rest" ? e.permission : ""} | ${(e.notes || []).join("; ")} |`
  );
  return [
    `# Entry points: ${report.pluginDir}`,
    "",
    `${report.entries.length} entry points · high: ${report.summary.high} · review: ${report.summary.review} · ok: ${report.summary.ok}`,
    "",
    "| Risk | Kind | Hook / route | Location | Callback | Nonce | Cap | REST permission | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Heuristic scan: confirm each finding in the code. ✓ found in the callback, helper = found in a $this->/self:: helper, ✗ not found, ? not resolved.",
    "",
  ].join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pluginDir = path.resolve(opts.dir || process.cwd());
  if (!statSafe(pluginDir)?.isDirectory()) {
    process.stderr.write(`Not a directory: ${pluginDir}\n`);
    process.exit(2);
  }
  const { files, entries } = scan(pluginDir);
  const summary = { high: 0, review: 0, ok: 0 };
  const byKind = {};
  for (const e of entries) {
    summary[e.risk] += 1;
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  }
  const report = { tool: { name: "list_entry_points", version: "0.1.0" }, pluginDir, filesScanned: files, summary, byKind, entries };
  process.stdout.write(opts.format === "md" ? toMarkdown(report) : `${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
