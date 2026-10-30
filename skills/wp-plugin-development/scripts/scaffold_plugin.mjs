import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Generates a new plugin from assets/plugin-template (plus optional feature overlays).
//
//   node scaffold_plugin.mjs --slug acme-reviews [--name "Acme Reviews"] [--dest ./acme-reviews]
//        [--prefix acme_reviews] [--namespace AcmeReviews] [--description "..."]
//        [--author "Acme"] [--author-uri URL] [--plugin-uri URL] [--contributors wporg-user]
//        [--tags "a, b"] [--composer-vendor acme] [--version 0.1.0]
//        [--wp-min 7.0] [--php-min 7.4] [--tested 7.1]
//        [--woocommerce] [--commercial [--update-uri URL]] [--elementor]
//        [--dry-run]
//
// Template syntax: {{key}} values, {{#key}}...{{/key}} when truthy, {{^key}}...{{/key}} when falsy.
// A section tag alone on its line removes that line. "__slug__" in file names becomes the slug.
// Refuses to write into a non-empty destination.

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDir = path.join(skillDir, "assets", "plugin-template");
const overlaysDir = path.join(skillDir, "assets", "overlays");
const FEATURES = ["woocommerce", "commercial", "elementor"];
const IGNORED_NAMES = new Set([".omc", ".DS_Store", "Thumbs.db"]);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === "dry-run" || FEATURES.includes(key) || key === "help") {
      opts[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for --${key}`);
    opts[key] = value;
    i += 1;
  }
  return opts;
}

function titleCase(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildContext(opts) {
  const slug = opts.slug;
  if (!slug) fail("--slug is required (lowercase letters, digits, hyphens).");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(`Invalid slug "${slug}".`);

  const name = opts.name ?? titleCase(slug);
  const prefix = opts.prefix ?? slug.replace(/-/g, "_");
  const namespace = opts.namespace ?? titleCase(slug).replace(/ /g, "");
  const author = opts.author ?? "Your Name";

  // Values end up inside PHP single-quoted strings, JSON and XML; keep them simple.
  for (const [label, value] of [["name", name], ["description", opts.description ?? ""], ["author", author]]) {
    if (/['"\\<>&]/.test(value)) fail(`--${label} must not contain quotes, backslashes, <, > or &.`);
  }
  if (!/^[a-z][a-z0-9_]{3,}$/.test(prefix) || /^(wp|_)/.test(prefix)) {
    fail(`Invalid prefix "${prefix}": 4+ chars, lowercase/digits/underscores, not starting with wp or _.`);
  }
  if (!/^[A-Z][A-Za-z0-9]*(?:\\[A-Z][A-Za-z0-9]*)*$/.test(namespace)) fail(`Invalid namespace "${namespace}".`);

  const features = Object.fromEntries(FEATURES.map((f) => [f, Boolean(opts[f])]));
  for (const f of FEATURES) {
    if (features[f] && !fs.existsSync(path.join(overlaysDir, f))) fail(`Feature --${f} has no overlay in assets/overlays/${f}.`);
  }

  const requiresPlugins = [features.woocommerce && "woocommerce", features.elementor && "elementor"].filter(Boolean).join(", ");
  const vendor = (opts["composer-vendor"] ?? author)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "vendor";

  return {
    slug,
    name,
    description: opts.description ?? `${name} plugin.`,
    version: opts.version ?? "0.1.0",
    author,
    author_uri: opts["author-uri"] ?? "https://example.com",
    plugin_uri: opts["plugin-uri"] ?? `https://example.com/${slug}`,
    contributors: opts.contributors ?? "your-wporg-username",
    tags: opts.tags ?? "",
    prefix,
    PREFIX: prefix.toUpperCase(),
    namespace,
    namespace_json: namespace.replace(/\\/g, "\\\\"),
    composer_name: `${vendor}/${slug}`,
    wp_min: opts["wp-min"] ?? "7.0",
    php_min: opts["php-min"] ?? "7.4",
    tested: opts.tested ?? "7.1",
    requires_plugins: requiresPlugins,
    update_uri: features.commercial ? opts["update-uri"] ?? `https://updates.example.com/${slug}` : "",
    external_services: features.commercial,
    ...features,
  };
}

export function render(text, ctx, file = "template") {
  // Standalone section tags: drop the whole line.
  let out = text.replace(/^[ \t]*(\{\{[#^/]\w+\}\})[ \t]*\r?\n/gm, "$1");

  const section = /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/;
  let guard = 0;
  while (section.test(out)) {
    out = out.replace(section, (_, kind, key, body) => {
      if (!(key in ctx)) throw new Error(`${file}: unknown section "${key}"`);
      const truthy = Boolean(ctx[key]);
      return (kind === "#" ? truthy : !truthy) ? body : "";
    });
    guard += 1;
    if (guard > 1000) throw new Error(`${file}: section nesting too deep`);
  }

  return out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in ctx)) throw new Error(`${file}: unknown placeholder "${key}"`);
    return String(ctx[key]);
  });
}

function collectFiles(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_NAMES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectFiles(full, base));
    else if (ent.isFile()) out.push(path.relative(base, full));
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    const usage = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//   ") || l.startsWith("//        "));
    process.stdout.write(`${usage.map((l) => l.slice(3)).join("\n")}\n`);
    return;
  }

  const ctx = buildContext(opts);
  const dest = path.resolve(opts.dest ?? ctx.slug);
  if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) fail(`Destination is not empty: ${dest}`);

  // Base template first, then each enabled feature overlay (overlay files replace base files).
  const sources = [templateDir, ...FEATURES.filter((f) => ctx[f]).map((f) => path.join(overlaysDir, f))];
  const files = new Map();
  for (const root of sources) {
    for (const rel of collectFiles(root)) files.set(rel, path.join(root, rel));
  }

  const written = [];
  for (const [rel, src] of [...files.entries()].sort()) {
    const target = path.join(dest, rel.replace(/__slug__/g, ctx.slug));
    const content = render(fs.readFileSync(src, "utf8"), ctx, rel);
    written.push(path.relative(dest, target).split(path.sep).join("/"));
    if (!opts["dry-run"]) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  }

  const report = {
    tool: { name: "scaffold_plugin", version: "0.1.0" },
    dryRun: Boolean(opts["dry-run"]),
    dest,
    slug: ctx.slug,
    prefix: ctx.prefix,
    namespace: ctx.namespace,
    features: FEATURES.filter((f) => ctx[f]),
    files: written,
    next: [
      `cd ${dest}`,
      "composer install",
      "npm install && npx wp-env start",
      "npm run test:php",
      "composer lint",
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
