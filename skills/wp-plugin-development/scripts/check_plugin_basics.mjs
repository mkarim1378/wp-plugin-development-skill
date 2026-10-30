import fs from "node:fs";
import path from "node:path";

// Heuristic, dependency-free first-pass checks for a WordPress plugin directory.
// Usage: node check_plugin_basics.mjs [plugin-dir] [--strict]
// Prints a JSON report. With --strict, exits 1 when any "error" finding exists.

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "tests",
  "test",
  ".wordpress-org",
]);

const MAX_FINDINGS = 500;
const MAX_PER_FILE_AND_ID = 10;

const I18N_FUNCTIONS = [
  "__",
  "_e",
  "_x",
  "_ex",
  "_n",
  "_nx",
  "_n_noop",
  "_nx_noop",
  "esc_html__",
  "esc_html_e",
  "esc_html_x",
  "esc_attr__",
  "esc_attr_e",
  "esc_attr_x",
];

const SANITIZE_TOKENS = [
  "sanitize_",
  "wp_unslash",
  "absint",
  "intval",
  "(int)",
  "(float)",
  "(bool)",
  "isset(",
  "isset (",
  "empty(",
  "empty (",
  "wp_verify_nonce",
  "check_admin_referer",
  "check_ajax_referer",
  "array_key_exists",
  "esc_url_raw",
  "wp_kses",
  "is_email",
  "rest_sanitize_",
  "filter_input",
];

const ESCAPE_TOKENS = [
  "esc_",
  "wp_kses",
  "absint",
  "intval",
  "(int)",
  "(float)",
  "number_format_i18n",
  "wp_json_encode",
  "json_encode",
  "checked(",
  "selected(",
  "disabled(",
  "wp_nonce_field",
  "submit_button",
  "get_block_wrapper_attributes",
];

function statSafe(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function listPhpFiles(root, { maxFiles = 4000, maxDepth = 8 } = {}) {
  const results = [];
  const queue = [{ dir: root, depth: 0 }];
  let truncated = false;

  while (queue.length > 0) {
    const { dir, depth } = queue.shift();
    if (depth > maxDepth) continue;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (IGNORED_DIRS.has(ent.name)) continue;
        queue.push({ dir: fullPath, depth: depth + 1 });
        continue;
      }
      if (!ent.isFile() || !ent.name.toLowerCase().endsWith(".php")) continue;
      if (results.length >= maxFiles) {
        truncated = true;
        return { results, truncated };
      }
      results.push(fullPath);
    }
  }

  return { results, truncated };
}

function parseHeader(contents, pairs) {
  const head = contents.slice(0, 8192);
  const header = {};
  for (const [label, key] of pairs) {
    const m = head.match(new RegExp(`^[ \\t/*#@]*${label}:\\s*(.+?)\\s*$`, "im"));
    if (m) header[key] = m[1].trim();
  }
  return header;
}

const PLUGIN_HEADER_FIELDS = [
  ["Plugin Name", "name"],
  ["Version", "version"],
  ["Requires at least", "requiresAtLeast"],
  ["Requires PHP", "requiresPhp"],
  ["Text Domain", "textDomain"],
  ["Domain Path", "domainPath"],
  ["License", "license"],
  ["Requires Plugins", "requiresPlugins"],
  ["Update URI", "updateUri"],
  ["Network", "network"],
];

const README_HEADER_FIELDS = [
  ["Stable tag", "stableTag"],
  ["Requires at least", "requiresAtLeast"],
  ["Requires PHP", "requiresPhp"],
  ["Tested up to", "testedUpTo"],
  ["License", "license"],
  ["Contributors", "contributors"],
];

// Find the index of the parenthesis matching the one at `openIndex`, skipping quoted strings.
function findClosingParen(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Split a call's argument string on top-level commas.
function splitArgs(argText) {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = "";
  for (let i = 0; i < argText.length; i += 1) {
    const ch = argText[i];
    if (quote) {
      current += ch;
      if (ch === "\\" && i + 1 < argText.length) {
        current += argText[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "(" || ch === "[") {
      depth += 1;
    } else if (ch === ")" || ch === "]") {
      depth -= 1;
    } else if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("#");
}

function hasAnyToken(line, tokens) {
  const lower = line.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

// Collects findings. `summary` counts every finding; the listed ones are capped per file+id
// and overall so one noisy pattern (e.g. a vendored library) doesn't drown the rest.
function createReporter() {
  const findings = [];
  const summary = { error: 0, warning: 0, info: 0 };
  const perFileAndId = new Map();
  const collapsed = {};
  let suppressed = 0;
  let dropped = 0;
  return {
    add(finding, sourceLine) {
      if (sourceLine && /phpcs:ignore|phpcs:disable|NOSONAR/.test(sourceLine)) {
        suppressed += 1;
        return;
      }
      summary[finding.severity] += 1;
      const key = `${finding.file}|${finding.id}`;
      const seen = (perFileAndId.get(key) || 0) + 1;
      perFileAndId.set(key, seen);
      if (seen > MAX_PER_FILE_AND_ID) {
        collapsed[key] = seen - MAX_PER_FILE_AND_ID;
        return;
      }
      if (findings.length >= MAX_FINDINGS) {
        dropped += 1;
        return;
      }
      findings.push(finding);
    },
    result() {
      return { findings, summary, collapsed, suppressed, dropped };
    },
  };
}

function findMainFile(pluginDir) {
  let entries;
  try {
    entries = fs.readdirSync(pluginDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith(".php")) continue;
    const fullPath = path.join(pluginDir, ent.name);
    const txt = readFileSafe(fullPath);
    if (!txt) continue;
    const header = parseHeader(txt, PLUGIN_HEADER_FIELDS);
    if (header.name) return { file: fullPath, header };
  }
  return null;
}

function checkHeaderAndReadme(pluginDir, main, report) {
  const slug = path.basename(path.resolve(pluginDir));
  const rel = path.relative(pluginDir, main.file);
  const h = main.header;

  for (const [key, label] of [
    ["version", "Version"],
    ["requiresAtLeast", "Requires at least"],
    ["requiresPhp", "Requires PHP"],
    ["textDomain", "Text Domain"],
    ["license", "License"],
  ]) {
    if (!h[key]) {
      report.add({ id: "header-missing-field", severity: "warning", file: rel, line: 1, message: `Plugin header is missing "${label}".` });
    }
  }

  if (h.textDomain && h.textDomain !== slug) {
    report.add({
      id: "header-text-domain-slug",
      severity: "warning",
      file: rel,
      line: 1,
      message: `Text Domain "${h.textDomain}" does not match the plugin directory slug "${slug}".`,
    });
  }

  const readmePath = ["readme.txt", "README.txt"].map((n) => path.join(pluginDir, n)).find((p) => statSafe(p));
  if (!readmePath) {
    report.add({ id: "readme-missing", severity: "info", file: "readme.txt", line: 0, message: "No readme.txt (required for WordPress.org)." });
    return null;
  }

  const readmeText = readFileSafe(readmePath) || "";
  const r = parseHeader(readmeText, README_HEADER_FIELDS);
  const readmeRel = path.relative(pluginDir, readmePath);

  if (!r.stableTag) {
    report.add({ id: "readme-missing-field", severity: "warning", file: readmeRel, line: 1, message: 'readme.txt is missing "Stable tag".' });
  } else if (h.version && r.stableTag !== h.version && r.stableTag !== "trunk") {
    report.add({
      id: "readme-stable-tag-mismatch",
      severity: "error",
      file: readmeRel,
      line: 1,
      message: `Stable tag "${r.stableTag}" does not match plugin header Version "${h.version}".`,
    });
  }
  if (!r.testedUpTo) {
    report.add({ id: "readme-missing-field", severity: "warning", file: readmeRel, line: 1, message: 'readme.txt is missing "Tested up to".' });
  }
  for (const [key, label] of [
    ["requiresAtLeast", "Requires at least"],
    ["requiresPhp", "Requires PHP"],
  ]) {
    if (h[key] && r[key] && h[key] !== r[key]) {
      report.add({
        id: "readme-header-mismatch",
        severity: "warning",
        file: readmeRel,
        line: 1,
        message: `"${label}" differs: plugin header "${h[key]}", readme.txt "${r[key]}".`,
      });
    }
  }
  return r;
}

function checkTextDomains(text, rel, expectedDomain, report, domainCounts) {
  const fnPattern = new RegExp(`(?<![\\w$>:])(${I18N_FUNCTIONS.join("|")})\\s*\\(`, "g");
  let m;
  while ((m = fnPattern.exec(text)) !== null) {
    const openIndex = m.index + m[0].length - 1;
    const closeIndex = findClosingParen(text, openIndex);
    if (closeIndex === -1) continue;
    const args = splitArgs(text.slice(openIndex + 1, closeIndex));
    const line = lineNumberAt(text, m.index);
    const sourceLine = text.split(/\r?\n/)[line - 1] || "";
    if (isCommentLine(sourceLine)) continue;

    const fn = m[1];
    // Text domain position: last argument for every function in I18N_FUNCTIONS.
    const minArgs = { _n: 4, _nx: 5, _n_noop: 3, _nx_noop: 4, _x: 3, _ex: 3, esc_html_x: 3, esc_attr_x: 3 }[fn] || 2;
    if (args.length < minArgs) {
      report.add({ id: "i18n-missing-text-domain", severity: "warning", file: rel, line, message: `${fn}() call without a text domain.` }, sourceLine);
      continue;
    }
    const domainArg = args[args.length - 1];
    const literal = domainArg.match(/^(['"])(.*)\1$/);
    if (!literal) {
      report.add(
        { id: "i18n-non-literal-text-domain", severity: "warning", file: rel, line, message: `${fn}() uses a non-literal text domain (${domainArg}); extraction tools need a string literal.` },
        sourceLine
      );
      continue;
    }
    const domain = literal[2];
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    if (expectedDomain && domain !== expectedDomain) {
      report.add(
        { id: "i18n-text-domain-mismatch", severity: "warning", file: rel, line, message: `${fn}() uses text domain "${domain}", expected "${expectedDomain}".` },
        sourceLine
      );
    }
    const firstArg = args[0] || "";
    if (/^\$/.test(firstArg)) {
      report.add(
        { id: "i18n-variable-string", severity: "warning", file: rel, line, message: `${fn}() translates a variable (${firstArg}); translation functions need string literals.` },
        sourceLine
      );
    }
  }
}

// Yields every call to a function matching `namePattern` with its parsed arguments (multi-line aware).
function* findCalls(text, namePattern) {
  const re = new RegExp(`(?<![\\w$>:])(${namePattern})\\s*\\(`, "g");
  const lines = text.split(/\r?\n/);
  let m;
  while ((m = re.exec(text)) !== null) {
    const openIndex = m.index + m[0].length - 1;
    const closeIndex = findClosingParen(text, openIndex);
    if (closeIndex === -1) continue;
    const line = lineNumberAt(text, m.index);
    const sourceLine = lines[line - 1] || "";
    if (isCommentLine(sourceLine)) continue;
    const argsText = text.slice(openIndex + 1, closeIndex);
    yield { name: m[1], line, sourceLine, argsText, args: splitArgs(argsText) };
  }
}

function literalValue(arg) {
  const m = (arg || "").match(/^(['"])(.*)\1$/s);
  return m ? m[2] : null;
}

const REQUEST_HOOKS = new Set(["init", "wp_loaded", "admin_init", "wp", "plugins_loaded", "template_redirect", "admin_menu", "wp_enqueue_scripts"]);

function checkCalls(text, rel, report) {
  for (const call of findCalls(text, "register_rest_route")) {
    if (call.argsText.includes("=>") && !/permission_callback/.test(call.argsText)) {
      report.add(
        { id: "rest-missing-permission-callback", severity: "warning", file: rel, line: call.line, message: "register_rest_route() without a permission_callback (WordPress raises _doing_it_wrong and the route is effectively public)." },
        call.sourceLine
      );
    }
  }

  for (const call of findCalls(text, "add_action|add_filter")) {
    const hook = literalValue(call.args[0]);
    if (hook === null) continue;

    if (hook.startsWith("wp_ajax_nopriv_")) {
      report.add(
        { id: "ajax-nopriv-handler", severity: "info", file: rel, line: call.line, message: `Public AJAX handler "${hook}": treat input as attacker-controlled, rate limit, and never return private data.` },
        call.sourceLine
      );
    }
    if (REQUEST_HOOKS.has(hook) && /\bflush_rewrite_rules\s*\(/.test(call.argsText)) {
      report.add(
        { id: "rewrite-flush-on-request", severity: "warning", file: rel, line: call.line, message: `flush_rewrite_rules() runs on "${hook}" (every request); flush only on activation/deactivation or a one-time upgrade step.` },
        call.sourceLine
      );
    }
    if (["plugins_loaded", "after_setup_theme", "muplugins_loaded"].includes(hook) && /load_plugin_textdomain|textdomain/i.test(call.argsText)) {
      report.add(
        { id: "i18n-textdomain-before-init", severity: "warning", file: rel, line: call.line, message: `Text domain loaded on "${hook}"; since WP 6.7 load translations on init or later (WordPress.org plugins don't need load_plugin_textdomain()).` },
        call.sourceLine
      );
    }
  }

  for (const call of findCalls(text, "add_option|update_option")) {
    const autoloadArg = call.name === "add_option" ? call.args[3] : call.args[2];
    if (autoloadArg && /^(true|['"](yes|on)['"])$/i.test(autoloadArg.trim())) {
      report.add(
        { id: "option-forced-autoload", severity: "info", file: rel, line: call.line, message: `${call.name}() forces autoload; only do this for small values needed on most requests (use false or null otherwise).` },
        call.sourceLine
      );
    }
  }

  if (/\$_FILES\b/.test(text) && !/\b(wp_handle_upload|media_handle_upload|wp_handle_sideload|media_handle_sideload)\s*\(/.test(text)) {
    const line = lineNumberAt(text, text.search(/\$_FILES\b/));
    report.add({ id: "upload-without-wp-handler", severity: "warning", file: rel, line, message: "$_FILES used without wp_handle_upload()/media_handle_upload(); uploads need WordPress type checks and storage." });
  }
  for (const call of findCalls(text, "move_uploaded_file")) {
    report.add({ id: "upload-move-uploaded-file", severity: "warning", file: rel, line: call.line, message: "move_uploaded_file() bypasses WordPress upload validation; use wp_handle_upload()." }, call.sourceLine);
  }
}

const WOOCOMMERCE_USAGE = /\bwc_get_orders?\s*\(|\bWC_Order\b|\bWC\(\)|\bWC_Payment_Gateway\b|['"]woocommerce_[a-z_]+['"]|\bwc_get_product\s*\(/;

// WooCommerce-specific rules; only meaningful for plugins that use WooCommerce (see main()).
function checkWooCommerce(text, rel, report, wooFacts) {
  if (WOOCOMMERCE_USAGE.test(text)) wooFacts.uses = true;
  if (/declare_compatibility\s*\(\s*['"]custom_order_tables['"]/.test(text)) wooFacts.declaresHpos = true;

  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return;
    const n = idx + 1;
    if (/\b(get|update|add|delete)_post_meta\s*\(\s*\$\w*order\w*/i.test(line)) {
      report.add({ id: "wc-order-post-meta", severity: "warning", file: rel, line: n, message: "Post meta API used on an order; with HPOS use $order->get_meta()/update_meta_data() + save()." }, line);
    }
    if (/['"]post_type['"]\s*=>\s*['"]shop_order['"]/.test(line)) {
      report.add({ id: "wc-order-post-query", severity: "warning", file: rel, line: n, message: "Orders queried as posts (post_type shop_order); use wc_get_orders() so HPOS stores work." }, line);
    }
    if (/shop_order/.test(line) && /\$wpdb->(posts|postmeta)|wp_post(s|meta)\b/.test(line)) {
      report.add({ id: "wc-order-posts-sql", severity: "warning", file: rel, line: n, message: "SQL on wp_posts/wp_postmeta for orders; HPOS stores orders in wc_orders tables." }, line);
    }
  });
}

function checkLines(text, rel, report, fileFacts) {
  const lines = text.split(/\r?\n/);
  const superglobal = /\$_(POST|GET|REQUEST|COOKIE|FILES)\b|\$_SERVER\s*\[/;
  const sqlCall = /\$wpdb->(query|get_results|get_row|get_var|get_col)\s*\(/;

  lines.forEach((rawLine, idx) => {
    const line = rawLine;
    const n = idx + 1;
    if (isCommentLine(line)) return;

    if (superglobal.test(line)) {
      fileFacts.readsInput = fileFacts.readsInput || /\$_(POST|REQUEST|FILES)\b/.test(line);
      if (!hasAnyToken(line, SANITIZE_TOKENS)) {
        report.add({ id: "input-raw-superglobal", severity: "warning", file: rel, line: n, message: "Superglobal read without visible wp_unslash()/sanitization on this line." }, line);
      }
      if (/(unserialize|maybe_unserialize|extract)\s*\(/.test(line)) {
        report.add({ id: "input-dangerous-call", severity: "error", file: rel, line: n, message: "unserialize()/extract() applied to request data." }, line);
      }
    }

    const sqlMatch = line.match(sqlCall);
    if (sqlMatch && !/->prepare\s*\(/.test(line)) {
      // Table names like {$wpdb->prefix} / $wpdb->posts are not user input; ignore them.
      const openIndex = sqlMatch.index + sqlMatch[0].length - 1;
      const closeIndex = findClosingParen(line, openIndex);
      const callArgs = line
        .slice(openIndex + 1, closeIndex === -1 ? undefined : closeIndex)
        .replace(/\{?\$wpdb->[a-z_]+\}?/g, "");
      const firstArg = splitArgs(callArgs)[0] || "";
      const queryVar = firstArg.match(/^\$([A-Za-z_]\w*)$/);
      if (queryVar) {
        // `$wpdb->get_var( $sql )`: fine when $sql was assigned from prepare() shortly before.
        const window = lines.slice(Math.max(0, idx - 25), idx).join("\n");
        const preparedBefore = new RegExp(`\\$${queryVar[1]}\\s*(\\.?=)\\s*\\$wpdb->prepare\\s*\\(`).test(window);
        if (!preparedBefore) {
          report.add({ id: "sql-unverified-variable", severity: "warning", file: rel, line: n, message: `Query passed as $${queryVar[1]}; confirm it was built with $wpdb->prepare().` }, line);
        }
      } else if (/\$[A-Za-z_]/.test(firstArg)) {
        const vars = firstArg.match(/\$[A-Za-z_]\w*/g) || [];
        const identifiersOnly = vars.every((v) => /table|tbl|prefix/i.test(v) || /^\$(p|px|pre)$/.test(v));
        report.add(
          identifiersOnly
            ? { id: "sql-interpolated-identifier", severity: "warning", file: rel, line: n, message: "Table name interpolated into SQL; prefer $wpdb->prepare() with %i, and make sure the name is not user-controlled." }
            : { id: "sql-unprepared", severity: "error", file: rel, line: n, message: "$wpdb query built with a variable but no $wpdb->prepare() on this line." },
          line
        );
      }
    }

    if (/->prepare\s*\(/.test(line) && /'%[sdfi]'|"%[sdfi]"/.test(line)) {
      report.add({ id: "sql-quoted-placeholder", severity: "warning", file: rel, line: n, message: "Quoted placeholder in $wpdb->prepare(); placeholders must not be quoted." }, line);
    }

    const echoMatch = line.match(/(?:\becho\b|\bprint\b|<\?=)\s*(.+)/);
    if (echoMatch && /\$/.test(echoMatch[1]) && !hasAnyToken(echoMatch[1], ESCAPE_TOKENS)) {
      report.add({ id: "output-unescaped", severity: "warning", file: rel, line: n, message: "Echoed value without a visible escaping function." }, line);
    }

    if (/(?<![\w$>:])_e\s*\(/.test(line)) {
      report.add({ id: "output-unescaped-translation", severity: "info", file: rel, line: n, message: "_e() prints unescaped; prefer esc_html_e()/esc_attr_e()." }, line);
    }

    if (/\beval\s*\(|\bcreate_function\s*\(/.test(line)) {
      report.add({ id: "dangerous-function", severity: "error", file: rel, line: n, message: "eval()/create_function() in plugin code." }, line);
    }
    if (/['"]sslverify['"]\s*=>\s*false/.test(line)) {
      report.add({ id: "http-sslverify-disabled", severity: "warning", file: rel, line: n, message: "TLS verification disabled for an HTTP request." }, line);
    }
    if (/\bcurl_init\s*\(|file_get_contents\s*\(\s*['"]https?:/.test(line)) {
      report.add({ id: "http-not-wp-api", severity: "warning", file: rel, line: n, message: "Remote request without the WordPress HTTP API (wp_remote_*)." }, line);
    }
    if (/\bwp_redirect\s*\(/.test(line)) {
      report.add({ id: "redirect-unsafe", severity: "info", file: rel, line: n, message: "wp_redirect() allows any host; use wp_safe_redirect() for user-influenced targets." }, line);
    }
    if (/permission_callback['"]?\s*=>\s*['"]__return_true['"]/.test(line)) {
      report.add({ id: "rest-public-route", severity: "info", file: rel, line: n, message: "REST route is public (__return_true); confirm it neither changes state nor exposes private data." }, line);
    }
    if (/\bregister_(activation|deactivation)_hook\s*\(/.test(line)) {
      fileFacts.registersLifecycle = true;
    }
    if (/\bregister_uninstall_hook\s*\(/.test(line)) {
      fileFacts.registersUninstall = true;
    }
    if (/wp_verify_nonce|check_admin_referer|check_ajax_referer|settings_fields\s*\(/.test(line)) {
      fileFacts.verifiesNonce = true;
    }
  });
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { strict: false, format: "json", uriPrefix: "", dir: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--strict") opts.strict = true;
    else if (argv[i] === "--format") opts.format = argv[++i];
    else if (argv[i] === "--uri-prefix") opts.uriPrefix = argv[++i] ?? "";
    else if (!argv[i].startsWith("--")) opts.dir = argv[i];
  }
  if (!["json", "sarif"].includes(opts.format)) {
    process.stderr.write(`Unknown --format "${opts.format}" (json or sarif).\n`);
    process.exit(2);
  }
  const pluginDir = path.resolve(opts.dir || process.cwd());

  if (!statSafe(pluginDir)?.isDirectory()) {
    process.stderr.write(`Not a directory: ${pluginDir}\n`);
    process.exit(2);
  }

  const reporter = createReporter();
  const mainFile = findMainFile(pluginDir);

  if (!mainFile) {
    reporter.add({ id: "main-file-missing", severity: "error", file: ".", line: 0, message: "No top-level PHP file with a Plugin Name header found." });
  }

  const readme = mainFile ? checkHeaderAndReadme(pluginDir, mainFile, reporter) : null;
  const expectedDomain = mainFile?.header.textDomain || null;
  const { results: phpFiles, truncated } = listPhpFiles(pluginDir);
  const domainCounts = {};
  let hasUninstallFile = false;
  let registersUninstall = false;
  const wooFacts = { uses: false, declaresHpos: false };

  for (const file of phpFiles) {
    const text = readFileSafe(file);
    if (text === null) continue;
    const rel = toPosix(path.relative(pluginDir, file));
    const isMain = mainFile && path.resolve(file) === path.resolve(mainFile.file);
    const isUninstall = rel === "uninstall.php";
    if (isUninstall) hasUninstallFile = true;

    if (isUninstall) {
      if (!/WP_UNINSTALL_PLUGIN/.test(text)) {
        reporter.add({ id: "uninstall-no-guard", severity: "error", file: rel, line: 1, message: "uninstall.php does not check WP_UNINSTALL_PLUGIN." });
      }
    } else if (!/\b(ABSPATH|WPINC|WP_UNINSTALL_PLUGIN)\b/.test(text)) {
      reporter.add({ id: "direct-access-guard", severity: "warning", file: rel, line: 1, message: "No ABSPATH guard (defined( 'ABSPATH' ) || exit;)." });
    }

    // PHP swallows one newline right after ?>; anything else is sent as output.
    if (/\?>(?:[ \t]+(?:\r?\n)?|\r?\n\s+)$/.test(text)) {
      reporter.add({ id: "trailing-whitespace-after-close-tag", severity: "warning", file: rel, line: lineNumberAt(text, text.lastIndexOf("?>")), message: "Whitespace after the closing ?> tag can cause 'headers already sent'; drop the closing tag." });
    }

    const facts = { readsInput: false, verifiesNonce: false, registersLifecycle: false, registersUninstall: false };
    checkLines(text, rel, reporter, facts);
    checkTextDomains(text, rel, expectedDomain, reporter, domainCounts);
    checkCalls(text, rel, reporter);
    checkWooCommerce(text, rel, reporter, wooFacts);

    if (facts.registersLifecycle && !isMain) {
      reporter.add({ id: "lifecycle-hook-outside-main", severity: "info", file: rel, line: 1, message: "Activation/deactivation hook registered outside the main file; make sure it passes the main file path, not __FILE__ of this file." });
    }
    if (facts.registersUninstall) registersUninstall = true;
    if (facts.readsInput && !facts.verifiesNonce) {
      reporter.add({ id: "csrf-no-nonce-check", severity: "warning", file: rel, line: 1, message: "Reads POST/REQUEST/FILES data but no nonce verification appears in this file." });
    }
  }

  if (mainFile && wooFacts.uses) {
    const mainRel = toPosix(path.relative(pluginDir, mainFile.file));
    if (!wooFacts.declaresHpos) {
      reporter.add({ id: "wc-missing-hpos-declaration", severity: "warning", file: mainRel, line: 1, message: "Uses WooCommerce but never declares HPOS (custom_order_tables) compatibility on before_woocommerce_init." });
    }
    if (!/(^|,\s*)woocommerce(\s*,|$)/.test(mainFile.header.requiresPlugins || "")) {
      reporter.add({ id: "wc-missing-requires-plugins", severity: "info", file: mainRel, line: 1, message: 'Uses WooCommerce but the header has no "Requires Plugins: woocommerce".' });
    }
  }

  if (mainFile && !hasUninstallFile && !registersUninstall) {
    reporter.add({ id: "uninstall-missing", severity: "info", file: ".", line: 0, message: "No uninstall.php or register_uninstall_hook(); confirm the plugin leaves no data behind (or document why)." });
  }

  const { findings, summary, collapsed, suppressed, dropped } = reporter.result();

  const report = {
    tool: { name: "check_plugin_basics", version: "0.2.0" },
    pluginDir,
    mainFile: mainFile ? toPosix(path.relative(pluginDir, mainFile.file)) : null,
    header: mainFile ? mainFile.header : null,
    readme,
    textDomains: domainCounts,
    filesScanned: phpFiles.length,
    truncated,
    summary,
    suppressedByPhpcsIgnore: suppressed,
    collapsedFindings: collapsed,
    droppedFindings: dropped,
    note: "Heuristic line-based checks. Findings need human review; a clean report is not a security review.",
    findings,
  };

  const output = opts.format === "sarif" ? toSarif(report, opts.uriPrefix) : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (opts.strict && summary.error > 0) process.exit(1);
}

// SARIF 2.1.0 for GitHub code scanning. `uriPrefix` maps plugin-relative paths to repo-relative ones.
function toSarif(report, uriPrefix) {
  const prefix = uriPrefix && !uriPrefix.endsWith("/") ? `${uriPrefix}/` : uriPrefix;
  const level = { error: "error", warning: "warning", info: "note" };
  const rules = new Map();
  for (const f of report.findings) {
    if (!rules.has(f.id)) {
      rules.set(f.id, { id: f.id, shortDescription: { text: f.message }, defaultConfiguration: { level: level[f.severity] } });
    }
  }
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: report.tool.name,
            version: report.tool.version,
            informationUri: "https://github.com/mkarim1378/wp-plugin-development-skill",
            rules: [...rules.values()],
          },
        },
        results: report.findings.map((f) => ({
          ruleId: f.id,
          level: level[f.severity],
          message: { text: f.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: `${prefix}${f.file === "." ? report.mainFile ?? "" : f.file}` },
                region: { startLine: Math.max(1, f.line || 1) },
              },
            },
          ],
        })),
      },
    ],
  };
}

main();
