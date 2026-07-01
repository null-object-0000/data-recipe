import type { DataRecipe } from "@data-recipe/recipe-core";

export interface DataSkillPackage {
  packageName: string;
  files: DataSkillPackageFile[];
}

export interface DataSkillPackageFile {
  path: "SKILL.md" | "recipe.json" | "examples.md" | "README.md";
  content: string;
}

export interface BuildDataSkillPackageInput {
  recipe: DataRecipe;
  userGoal?: string;
}

export function buildDataSkillPackage(input: BuildDataSkillPackageInput): DataSkillPackage {
  const packageName = input.recipe.name || "data-skill";
  const goal = input.userGoal?.trim() || input.recipe.description;

  return {
    packageName,
    files: [
      { path: "SKILL.md", content: buildSkillMarkdown(input.recipe, goal) },
      { path: "recipe.json", content: `${JSON.stringify(input.recipe, null, 2)}\n` },
      { path: "examples.md", content: buildExamplesMarkdown(input.recipe, goal) },
      { path: "README.md", content: buildReadmeMarkdown(input.recipe, goal) }
    ]
  };
}

function buildSkillMarkdown(recipe: DataRecipe, goal: string): string {
  const fields = recipe.fields.length
    ? recipe.fields.map((field) => `- ${field.displayName} (${field.name}): ${field.description}`).join("\n")
    : "- 暂未确认返回字段。";
  const queryFields = [...recipe.request.queryFields, ...recipe.request.bodyFields];
  const queries = queryFields.length
    ? queryFields.map((field) => `- ${field.displayName} (${field.name})`).join("\n")
    : "- 当前数据来源没有明确的查询条件。";

  return `# ${recipe.displayName}\n\n## 适合完成的任务\n\n${goal}\n\n## 数据来源\n\n这个技能会从用户已授权访问的页面数据来源读取数据。\n\n## 查询条件\n\n${queries}\n\n## 返回字段\n\n${fields}\n\n## 使用限制\n\n- 只用于用户有权访问的数据。\n- 不用于绕过登录、验证码、风控或访问限制。\n- 运行前应先用 recipe.json 测试数据预览是否正常。\n`;
}

function buildExamplesMarkdown(recipe: DataRecipe, goal: string): string {
  const firstUseCase = recipe.useCases[0] ?? goal;

  return `# 示例\n\n## 示例问题\n\n- 请根据「${recipe.displayName}」查看最新数据。\n- 请基于这些数据完成：${firstUseCase}\n\n## 示例输出\n\n系统会先测试运行 recipe.json，确认能读取数据，再基于返回字段进行整理和分析。\n`;
}

function buildReadmeMarkdown(recipe: DataRecipe, goal: string): string {
  return `# ${recipe.displayName}\n\n${goal}\n\n## 包含文件\n\n- SKILL.md: 给 AI Agent 使用的技能说明。\n- recipe.json: 可测试运行的数据配方。\n- examples.md: 示例问题和示例输出。\n- README.md: 给人看的说明。\n\n## 验证方式\n\n用 recipe.json 进行测试运行，并确认可以读取预期数据。\n`;
}
