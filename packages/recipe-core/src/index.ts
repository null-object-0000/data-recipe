export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | string;

export type JsonObject = Record<string, unknown>;

export interface DataRecipe {
  name: string;
  displayName: string;
  source: DataRecipeSource;
  request: DataRecipeRequest;
  response: DataRecipeResponse;
  pagination: DataRecipePagination;
  fields: DataRecipeField[];
}

export interface DataRecipeSource {
  type: "web_api";
  pageUrl: string;
  apiUrl: string;
  method: HttpMethod;
}

export interface DataRecipeRequest {
  query: JsonObject;
  body: unknown;
}

export interface DataRecipeResponse {
  type: "list" | "object" | "unknown";
  listPath: string;
  totalPath: string;
}

export interface DataRecipePagination {
  type: "page_number" | "cursor" | "unknown";
  pageParam: string;
  pageSizeParam: string;
  totalPath: string;
}

export interface DataRecipeField {
  name: string;
  path: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "null" | "unknown";
  sample?: unknown;
}

export interface CreateRecipeInput {
  pageUrl: string;
  apiUrl: string;
  method: HttpMethod;
  query: JsonObject;
  body: unknown;
  responseType: DataRecipeResponse["type"];
  listPath: string;
  totalPath: string;
  fields: DataRecipeField[];
}

export function createDataRecipeDraft(input: CreateRecipeInput): DataRecipe {
  const name = buildRecipeName(input.apiUrl);

  return {
    name,
    displayName: "数据来源",
    source: {
      type: "web_api",
      pageUrl: input.pageUrl,
      apiUrl: input.apiUrl,
      method: input.method
    },
    request: {
      query: input.query,
      body: input.body ?? {}
    },
    response: {
      type: input.responseType,
      listPath: input.listPath,
      totalPath: input.totalPath
    },
    pagination: {
      type: "page_number",
      pageParam: "",
      pageSizeParam: "",
      totalPath: input.totalPath
    },
    fields: input.fields
  };
}

function buildRecipeName(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    const pathPart = url.pathname
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join("_");
    return normalizeName(pathPart || url.hostname);
  } catch {
    return normalizeName(apiUrl || "data_source");
  }
}

function normalizeName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "data_source";
}
