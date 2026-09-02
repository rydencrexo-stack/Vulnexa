// Reads the user's skill library (SKILL.md frontmatter) and emits a TypeScript
// catalog consumed by the Bug Hunter. Run with: node scripts/skills-gen.js
// Output: frontend/features/security-console/bug-hunter/skills-library.ts
const { readdirSync, readFileSync, existsSync, writeFileSync } = require("fs");
const { join } = require("path");

const BASE = process.env.SKILLS_DIR || "C:/Users/Welcome/Downloads/skills/skills";
const OUT = "frontend/features/security-console/bug-hunter/skills-library.ts";

function frontmatter(file) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { name: "", desc: "" };
  const fm = m[1];
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || "";
  const desc = ((fm.match(/^description:\s*(.+)$/m) || [])[1] || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .slice(0, 400);
  return { name, desc };
}

if (!existsSync(BASE)) {
  console.error(`Skill dir not found: ${BASE}`);
  console.error("Set SKILLS_DIR to your library (backslashes escaped or forward slashes).");
  process.exit(1);
}

const items = readdirSync(BASE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(BASE, d.name, "SKILL.md"))
  .filter((f) => existsSync(f))
  .map((f) => frontmatter(f))
  .map((x) => ({ ...x, name: x.name || x.desc.split(" ")[0] || "skill" }))
  .filter((x) => x.desc);

const lines = [
  "// AUTO-GENERATED from the skill library. Do not edit by hand; rerun scripts/skills-gen.js",
  "",
  "export interface LibrarySkill {",
  "  id: string;",
  "  name: string;",
  "  description: string;",
  "  category: string;",
  "}",
  "",
  "export const LIBRARY_SKILLS: LibrarySkill[] = [",
];
for (const x of items) {
  const id = x.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  let cat = "Methodology";
  if (x.name.startsWith("hunt-")) cat = "Vulnerability Hunt";
  else if (x.name.includes("osint") || x.name.includes("recon")) cat = "Recon / OSINT";
  else if (x.name.includes("report") || x.name.includes("writing") || x.name.includes("validation")) cat = "Reporting";
  else if (x.name.includes("evidence") || x.name.includes("hygiene")) cat = "Evidence";
  else if (x.name.includes("methodology") || x.name.includes("triage") || x.name.includes("mindset") || x.name.includes("discipline")) cat = "Methodology";
  lines.push(`  { id: ${JSON.stringify(id)}, name: ${JSON.stringify(x.name)}, category: ${JSON.stringify(cat)}, description: ${JSON.stringify(x.desc)} },`);
}
lines.push("];", "");
lines.push("export function librarySkill(id: string): LibrarySkill | undefined {");
lines.push("  return LIBRARY_SKILLS.find((s) => s.id === id);");
lines.push("}", "");
lines.push("export const LIBRARY_SKILL_COUNT = LIBRARY_SKILLS.length;", "");

writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${items.length} skills to ${OUT}`);
