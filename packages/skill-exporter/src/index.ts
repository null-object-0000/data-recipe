import type { DataSkillPackage } from "@data-recipe/skill-builder";

export interface DataSkillPackageValidation {
  ok: boolean;
  missingFiles: string[];
}

const REQUIRED_FILES = ["SKILL.md", "recipe.json", "examples.md", "README.md"] as const;

export function validateDataSkillPackage(skillPackage: DataSkillPackage): DataSkillPackageValidation {
  const existing = new Set(skillPackage.files.map((file) => file.path));
  const missingFiles = REQUIRED_FILES.filter((file) => !existing.has(file));

  return {
    ok: missingFiles.length === 0,
    missingFiles
  };
}
export interface ExportedDataSkillPackage {
  fileName: string;
  mimeType: "application/json";
  content: string;
}

export function exportDataSkillPackageAsJson(skillPackage: DataSkillPackage): ExportedDataSkillPackage {
  const safeName = normalizeFileName(skillPackage.packageName || "data-skill");
  return {
    fileName: `${safeName}.data-skill.json`,
    mimeType: "application/json",
    content: `${JSON.stringify(skillPackage, null, 2)}\n`
  };
}

function normalizeFileName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "data-skill";
}

