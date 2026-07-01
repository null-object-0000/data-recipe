import { readFile } from "node:fs/promises";

const requiredFiles = ["SKILL.md", "recipe.json", "examples.md", "README.md"];
const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: pnpm validate:skill-package <path-to-.data-skill.json>");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(await readFile(filePath, "utf8"));
} catch (error) {
  console.error(`Invalid JSON package: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const files = Array.isArray(parsed.files) ? parsed.files : [];
const existing = new Set(files.map((file) => file?.path));
const missing = requiredFiles.filter((file) => !existing.has(file));
const empty = files
  .filter((file) => typeof file?.content !== "string" || file.content.trim() === "")
  .map((file) => file?.path ?? "(unknown)");

if (typeof parsed.packageName !== "string" || parsed.packageName.trim() === "") {
  console.error("Invalid package: packageName is required.");
  process.exit(1);
}

if (missing.length > 0 || empty.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing files: ${missing.join(", ")}`);
  }
  if (empty.length > 0) {
    console.error(`Empty files: ${empty.join(", ")}`);
  }
  process.exit(1);
}

console.log(`Valid Data Skill Package: ${parsed.packageName}`);
console.log(`Files: ${requiredFiles.join(", ")}`);
