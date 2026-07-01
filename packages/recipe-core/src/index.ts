export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | string;

export type JsonObject = Record<string, unknown>;

export type DataValueType = "string" | "number" | "boolean" | "object" | "array" | "null" | "unknown";

export interface DataRecipe {
  name: string;
  displayName: string;
  description: string;
  useCases: string[];
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
  queryFields: DataRecipeParameter[];
  bodyFields: DataRecipeParameter[];
}

export interface DataRecipeParameter {
  name: string;
  displayName: string;
  path: string;
  type: DataValueType;
  required: boolean;
  sample?: unknown;
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
  displayName: string;
  path: string;
  type: DataValueType;
  sample?: unknown;
  description: string;
}

export interface CreateRecipeInput {
  pageUrl: string;
  apiUrl: string;
  method: HttpMethod;
  query: JsonObject;
  body: unknown;
  queryFields?: DataRecipeParameter[];
  bodyFields?: DataRecipeParameter[];
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
    description: "用于获取和预览这个数据来源中的列表数据。",
    useCases: ["查看数据明细", "汇总和分析列表数据"],
    source: {
      type: "web_api",
      pageUrl: input.pageUrl,
      apiUrl: input.apiUrl,
      method: input.method
    },
    request: {
      query: input.query,
      body: input.body ?? {},
      queryFields: input.queryFields ?? inferParameters(input.query, "query"),
      bodyFields: input.bodyFields ?? inferParameters(input.body, "body")
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

export function inferParameters(value: unknown, rootPath: "query" | "body"): DataRecipeParameter[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).slice(0, 50).map(([name, sample]) => ({
    name,
    displayName: name,
    path: `${rootPath}.${name}`,
    type: inferDataValueType(sample),
    required: false,
    sample: simplifySample(sample)
  }));
}

export function inferDataValueType(value: unknown): DataValueType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return "unknown";
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

function simplifySample(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 2);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 5));
  }

  return value;
}

