import type { PageControlMessage } from "./messages";

type CapturePayload = {
  url: string;
  method: string;
  status: number;
  requestBody: unknown;
  responseBody: unknown;
  responsePreview: string;
  transport: "fetch" | "xhr";
};

const state = {
  enabled: false,
  fetchPatched: false,
  xhrPatched: false
};

patchFetch();
patchXhr();

window.addEventListener("message", (event: MessageEvent<PageControlMessage>) => {
  if (event.source !== window || event.data?.source !== "data-recipe-content") {
    return;
  }

  state.enabled = event.data.type === "start-discovery";
});

function patchFetch(): void {
  if (state.fetchPatched || !window.fetch) {
    return;
  }

  state.fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestInfo = await readFetchRequest(input, init);
    const response = await originalFetch(input, init);

    if (state.enabled) {
      void readResponseBody(response.clone()).then((responseBody) => {
        emitCapture({
          ...requestInfo,
          status: response.status,
          responseBody,
          responsePreview: makePreview(responseBody),
          transport: "fetch"
        });
      });
    }

    return response;
  };
}

function patchXhr(): void {
  if (state.xhrPatched || !window.XMLHttpRequest) {
    return;
  }

  state.xhrPatched = true;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function open(method: string, url: string | URL): void {
    this.__dataRecipe = {
      method,
      url: String(url),
      requestBody: null
    };
    return originalOpen.apply(this, arguments as unknown as Parameters<typeof originalOpen>);
  };

  XMLHttpRequest.prototype.send = function send(body?: Document | XMLHttpRequestBodyInit | null): void {
    if (this.__dataRecipe) {
      this.__dataRecipe.requestBody = serializeBody(body);
    }

    this.addEventListener("loadend", () => {
      if (!state.enabled || !this.__dataRecipe) {
        return;
      }

      const responseBody = parseJsonLike(this.responseText);
      emitCapture({
        url: toAbsoluteUrl(this.__dataRecipe.url),
        method: this.__dataRecipe.method,
        status: this.status,
        requestBody: this.__dataRecipe.requestBody,
        responseBody,
        responsePreview: makePreview(responseBody),
        transport: "xhr"
      });
    });

    return originalSend.apply(this, arguments as unknown as Parameters<typeof originalSend>);
  };
}

async function readFetchRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Omit<CapturePayload, "status" | "responseBody" | "responsePreview" | "transport">> {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const url = input instanceof Request ? input.url : String(input);
  const requestBody = init?.body !== undefined ? serializeBody(init.body) : await readRequestClone(input);

  return {
    url: toAbsoluteUrl(url),
    method: method.toUpperCase(),
    requestBody
  };
}

async function readRequestClone(input: RequestInfo | URL): Promise<unknown> {
  if (!(input instanceof Request)) {
    return null;
  }

  try {
    return parseJsonLike(await input.clone().text());
  } catch {
    return null;
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return parseJsonLike(await response.text());
  } catch {
    return null;
  }
}

function serializeBody(body: unknown): unknown {
  if (body === undefined || body === null) {
    return null;
  }

  if (typeof body === "string") {
    return parseJsonLike(body);
  }

  if (body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries());
  }

  if (body instanceof FormData) {
    return Object.fromEntries(Array.from(body.entries()).map(([key, value]) => [key, String(value)]));
  }

  if (body instanceof Blob || body instanceof ArrayBuffer) {
    return "[binary body]";
  }

  return String(body);
}

function parseJsonLike(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function makePreview(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > 1800 ? `${text.slice(0, 1800)}...` : text;
}

function toAbsoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function emitCapture(payload: CapturePayload): void {
  window.postMessage(
    {
      source: "data-recipe-page-hook",
      type: "captured-request",
      payload
    },
    "*"
  );
}

declare global {
  interface XMLHttpRequest {
    __dataRecipe?: {
      method: string;
      url: string;
      requestBody: unknown;
    };
  }
}
