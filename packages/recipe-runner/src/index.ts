import type { DataRecipe } from "@data-recipe/recipe-core";

export interface RecipeRunResult {
  recipe: DataRecipe;
  rows: unknown[];
  rowCount: number;
  previewRows: unknown[];
  status: "ok" | "empty" | "unsupported";
  message: string;
}

export interface RunRecipeOnSampleOptions {
  previewLimit?: number;
}

export function runRecipeOnSample(
  recipe: DataRecipe,
  responseBody: unknown,
  options: RunRecipeOnSampleOptions = {}
): RecipeRunResult {
  const previewLimit = options.previewLimit ?? 5;
  const listValue = getByPath(responseBody, recipe.response.listPath);

  if (!Array.isArray(listValue)) {
    return {
      recipe,
      rows: [],
      rowCount: 0,
      previewRows: [],
      status: recipe.response.type === "list" ? "empty" : "unsupported",
      message: recipe.response.type === "list" ? "没有从当前响应中读取到列表数据。" : "当前数据来源暂不适合按列表预览。"
    };
  }

  const rows = listValue;

  return {
    recipe,
    rows,
    rowCount: rows.length,
    previewRows: rows.slice(0, previewLimit),
    status: rows.length > 0 ? "ok" : "empty",
    message: rows.length > 0 ? `已读取 ${rows.length} 条数据，下面展示前 ${Math.min(rows.length, previewLimit)} 条。` : "当前列表没有数据。"
  };
}

function getByPath(value: unknown, path: string): unknown {
  if (!path || path === "$") {
    return value;
  }

  const parts = path
    .replace(/^\$\.?/, "")
    .split(".")
    .filter(Boolean);

  return parts.reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    const arrayMatch = part.match(/^(.*)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexText] = arrayMatch;
      const container = key ? (current as Record<string, unknown>)[key] : current;
      const index = Number(indexText);
      return Array.isArray(container) ? container[index] : undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, value);
}
