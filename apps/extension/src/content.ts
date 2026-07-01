import { formatPreview, parseQueryFromUrl, tryParseJson, type CapturedRequest } from "@data-recipe/detector";
import type { PageCapturedMessage, PageControlMessage, TabControlMessage } from "./messages";

const scriptId = "data-recipe-page-hook";

injectPageHook();

chrome.runtime.onMessage.addListener((message: TabControlMessage) => {
  if (message.type === "start-discovery" || message.type === "stop-discovery") {
    postControl(message.type);
  }
});

window.addEventListener("message", (event: MessageEvent<PageCapturedMessage>) => {
  if (event.source !== window || event.data?.source !== "data-recipe-page-hook") {
    return;
  }

  if (event.data.type !== "captured-request") {
    return;
  }

  const payload = event.data.payload;
  const responseBody =
    typeof payload.responseBody === "string" ? tryParseJson(payload.responseBody) : payload.responseBody;

  const capture: CapturedRequest = {
    ...payload,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    pageUrl: window.location.href,
    query: parseQueryFromUrl(payload.url),
    responseBody,
    responsePreview: formatPreview(responseBody),
    capturedAt: Date.now()
  };

  void chrome.runtime.sendMessage({ type: "captured-request", capture });
});

function injectPageHook(): void {
  if (document.getElementById(scriptId)) {
    return;
  }

  const script = document.createElement("script");
  script.id = scriptId;
  script.src = chrome.runtime.getURL("page-hook.global.js");
  script.async = false;
  (document.documentElement || document.head).appendChild(script);
  script.remove();
}

function postControl(type: PageControlMessage["type"]): void {
  const message: PageControlMessage = {
    source: "data-recipe-content",
    type
  };
  window.postMessage(message, "*");
}
