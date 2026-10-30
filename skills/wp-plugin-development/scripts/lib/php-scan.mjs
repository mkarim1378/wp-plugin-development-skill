import fs from "node:fs";
import path from "node:path";

// Shared, dependency-free helpers for scanning PHP source heuristically (no PHP parser).
// Used by check_plugin_basics.mjs and list_entry_points.mjs.

export const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "tests",
  "test",
  ".wordpress-org",
]);

export function statSafe(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

export function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

export function listPhpFiles(root, { maxFiles = 4000, maxDepth = 8 } = {}) {
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

// Find the index of the parenthesis matching the one at `openIndex`, skipping quoted strings.
export function findClosingParen(text, openIndex) {
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
export function splitArgs(argText) {
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

export function toPosix(p) {
  return p.split(path.sep).join("/");
}

export function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

export function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("#");
}

// Yields every call to a function matching `namePattern` with its parsed arguments (multi-line aware).
export function* findCalls(text, namePattern) {
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

export function literalValue(arg) {
  const m = (arg || "").match(/^(['"])(.*)\1$/s);
  return m ? m[2] : null;
}

// Returns the body (between braces) of the first function/method named `name`, or null.
export function findFunctionBody(text, name) {
  const re = new RegExp(`function\\s+&?${name}\\s*\\(`, "i");
  const m = re.exec(text);
  if (!m) return null;
  const open = text.indexOf("{", findClosingParen(text, m.index + m[0].length - 1));
  if (open === -1) return null;
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open + 1, i), line: lineNumberAt(text, m.index) };
    }
  }
  return null;
}
