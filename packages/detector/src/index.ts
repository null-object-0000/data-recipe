import {
  createDataRecipeDraft,
  type DataRecipe,
  inferDataValueType,
  type DataRecipeField,
  type JsonObject
} from "@data-recipe/recipe-core";

export interface CapturedRequest {
  id: string;
  pageUrl: string;
  url: string;
  method: string;
  status: number;
  requestBody: unknown;
  query: JsonObject;
  responseBody: unknown;
  responsePreview: string;
  capturedAt: number;
  transport: "fetch" | "xhr";
}

export interface ResponseDetection {
  isJson: boolean;
  looksLikeList: boolean;
  hasArray: boolean;
  arrayPaths: string[];
  listPath: string;
  totalPath: string;
  keywordPaths: string[];
  fields: DataRecipeField[];
}

const TOTAL_KEYS = new Set(["total", "count", "totalCount", "total_count", "recordCount", "record_count"]);
const LIST_KEYS = new Set(["records", "list", "items", "rows", "data", "result"]);
const PAGE_KEYS = new Set(["page", "pageNo", "pageNum", "page_number", "current", "currentPage", "pageSize"]);

export function parseQueryFromUrl(urlValue: string): JsonObject {
  try {
    const url = new URL(urlValue);
    const query: JsonObject = {};
    url.searchParams.forEach((value, key) => {
      if (query[key] === undefined) {
        query[key] = value;
      } else if (Array.isArray(query[key])) {
        (query[key] as string[]).push(value);
      } else {
        query[key] = [query[key], value];
      }
    });
    return query;
  } catch {
    return {};
  }
}

export function tryParseJson(text: string): unknown {
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function summarizeResponse(responseBody: unknown): ResponseDetection {
  const isJson = responseBody !== null && typeof responseBody === "object";
  const arrayPaths: string[] = [];
  const keywordPaths: string[] = [];
  const totalPaths: string[] = [];

  if (isJson) {
    walk(responseBody, "$", (path, value, key) => {
      if (Array.isArray(value)) {
        arrayPaths.push(path);
      }

      if (key && (TOTAL_KEYS.has(key) || LIST_KEYS.has(key) || PAGE_KEYS.has(key))) {
        keywordPaths.push(path);
      }

      if (key && TOTAL_KEYS.has(key) && typeof value !== "object") {
        totalPaths.push(path);
      }
    });
  }

  const listPath = pickListPath(responseBody, arrayPaths);
  const fields = inferFieldsAtPath(responseBody, listPath);

  return {
    isJson,
    looksLikeList: arrayPaths.length > 0 && fields.length > 0,
    hasArray: arrayPaths.length > 0,
    arrayPaths,
    listPath,
    totalPath: totalPaths[0] ?? "",
    keywordPaths,
    fields
  };
}

export function buildRecipeFromCapture(capture: CapturedRequest): DataRecipe {
  const detection = summarizeResponse(capture.responseBody);

  return createDataRecipeDraft({
    pageUrl: capture.pageUrl,
    apiUrl: capture.url,
    method: capture.method,
    query: capture.query,
    body: capture.requestBody ?? {},
    responseType: detection.looksLikeList ? "list" : detection.isJson ? "object" : "unknown",
    listPath: detection.listPath,
    totalPath: detection.totalPath,
    fields: detection.fields
  });
}

export function formatPreview(value: unknown, maxLength = 1800): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  if (!text) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function pickListPath(responseBody: unknown, arrayPaths: string[]): string {
  if (arrayPaths.length === 0) {
    return "";
  }

  const preferred = arrayPaths.find((path) => {
    const key = path.split(".").at(-1) ?? "";
    return LIST_KEYS.has(key);
  });

  return preferred ?? arrayPaths[0] ?? "";
}

function inferFieldsAtPath(responseBody: unknown, listPath: string): DataRecipeField[] {
  const target = getByPath(responseBody, listPath);
  const sample = Array.isArray(target) ? target.find((item) => item && typeof item === "object") : null;

  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    return [];
  }

  return Object.entries(sample).map(([key, value]) => ({
    name: key,
    displayName: key,
    path: `${listPath}.${key}`,
    type: inferDataValueType(value),
    sample: simplifySample(value),
    description: "待确认"
  }));
}

function getByPath(value: unknown, path: string): unknown {
  if (!path || path === "$") {
    return value;
  }

  return path
    .replace(/^\$\./, "")
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, part) => {
      if (current && typeof current === "object" && part in current) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, value);
}

function walk(value: unknown, path: string, visit: (path: string, value: unknown, key?: string) => void): void {
  visit(path, value, path.split(".").at(-1));

  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, index) => walk(item, `${path}[${index}]`, visit));
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
    const childPath = path === "$" ? `$.${key}` : `${path}.${key}`;
    walk(child, childPath, visit);
  });
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


