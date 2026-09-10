import { readFileSync } from "node:fs";

const FILE = "src/globals.css";
const STATE = ".collapsed";

function parseRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let depth = 0;
  let buffer = "";
  let selector = null;

  for (const ch of text) {
    if (ch === "{") {
      depth += 1;
      if (selector === null) {
        selector = buffer.trim();
        buffer = "";
      } else {
        buffer += ch;
      }
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (selector !== null && !selector.startsWith("@")) {
        rules.push({ selector, body: buffer });
      }
      selector = null;
      buffer = "";
      continue;
    }
    buffer += ch;
  }
  return rules;
}

function declarations(body) {
  const out = new Map();
  for (const part of body.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    out.set(part.slice(0, idx).trim(), part.slice(idx + 1).trim());
  }
  return out;
}

function transitionedProps(value) {
  return new Set(
    value
      .split(",")
      .map((seg) => seg.trim().split(/\s+/)[0])
      .filter(Boolean)
  );
}

const rules = parseRules(readFileSync(FILE, "utf8"));

const bases = new Map();
for (const rule of rules) {
  for (const sel of rule.selector.split(",")) {
    const key = sel.trim();
    if (!key || key.includes(STATE)) continue;
    if (!bases.has(key)) bases.set(key, []);
    bases.get(key).push(rule);
  }
}

const problems = [];
for (const rule of rules) {
  if (!rule.selector.includes(STATE)) continue;
  const changed = new Set(declarations(rule.body).keys());
  for (const sel of rule.selector.split(",")) {
    if (!sel.includes(STATE)) continue;
    const target = sel.replaceAll(".sidebar.collapsed", "").trim();
    const key = target ? target.split(/\s+/).pop() : ".sidebar";
    for (const base of bases.get(key) ?? []) {
      const value = declarations(base.body).get("transition");
      if (!value) continue;
      const animated = transitionedProps(value);
      const hits = [...changed].filter(
        (p) => animated.has(p) || animated.has("all")
      );
      if (hits.length > 0) problems.push({ key, hits, value });
    }
  }
}

if (problems.length > 0) {
  console.error(`${FILE}: state changes that are still transitioned\n`);
  for (const p of problems) {
    console.error(`  ${p.key} animates ${p.hits.join(", ")} on ${STATE}`);
    console.error(`    transition: ${p.value}\n`);
  }
  console.error("The sidebar width snaps in one frame, so anything inside it");
  console.error("that still animates arrives late and reads as drift. Drop");
  console.error("these, or give the sidebar its width transition back.");
  process.exit(1);
}

console.log(`${FILE}: no ${STATE} property is still transitioned`);
