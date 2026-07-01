import type { DataSkillPackage } from "@data-recipe/skill-builder";

export interface DataSkillPackageValidation {
  ok: boolean;
  missingFiles: string[];
  errors: string[];
}

export interface ExportedDataSkillPackage {
  fileName: string;
  mimeType: "application/json";
  content: string;
}

const REQUIRED_FILES = ["SKILL.md", "recipe.json", "examples.md", "README.md"] as const;

export function validateDataSkillPackage(skillPackage: DataSkillPackage): DataSkillPackageValidation {
  const existing = new Set(skillPackage.files.map((file) => file.path));
  const missingFiles = REQUIRED_FILES.filter((file) => !existing.has(file));
  const errors: string[] = [];

  if (!skillPackage.packageName.trim()) {
    errors.push("packageName is required");
  }

  skillPackage.files.forEach((file) => {
    if (!file.content.trim()) {
      errors.push(`${file.path} is empty`);
    }
  });

  return {
    ok: missingFiles.length === 0 && errors.length === 0,
    missingFiles,
    errors
  };
}

export function validateExportedDataSkillPackageJson(content: string): DataSkillPackageValidation {
  try {
    const parsed = JSON.parse(content) as DataSkillPackage;

    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.files)) {
      return {
        ok: false,
        missingFiles: [...REQUIRED_FILES],
        errors: ["exported package must contain a files array"]
      };
    }

    return validateDataSkillPackage(parsed);
  } catch {
    return {
      ok: false,
      missingFiles: [...REQUIRED_FILES],
      errors: ["exported package is not valid JSON"]
    };
  }
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
