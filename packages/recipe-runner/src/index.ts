import type { DataRecipe } from "@data-recipe/recipe-core";

export interface RecipeRunResult {
  recipe: DataRecipe;
  rows: unknown[];
}
