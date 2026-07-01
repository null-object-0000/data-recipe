import type { DataSkillPackage } from "@data-recipe/skill-builder";

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
