import { buildRecipeFromCapture, summarizeResponse, type CapturedRequest } from "@data-recipe/detector";
import type { PanelEvent, PanelSnapshot } from "./messages";

const port = chrome.runtime.connect({ name: "data-recipe-sidepanel" });

const state: {
  snapshot: PanelSnapshot;
  selectedId: string | null;
} = {
  snapshot: {
    tabId: null,
    state: "idle",
    captures: []
  },
  selectedId: null
};

const elements = {
  statusBadge: getElement<HTMLSpanElement>("statusBadge"),
  startButton: getElement<HTMLButtonElement>("startButton"),
  stopButton: getElement<HTMLButtonElement>("stopButton"),
  captureCount: getElement<HTMLElement>("captureCount"),
  requestList: getElement<HTMLElement>("requestList"),
  requestDetail: getElement<HTMLElement>("requestDetail")
};

elements.startButton.addEventListener("click", () => port.postMessage({ type: "start-discovery" }));
elements.stopButton.addEventListener("click", () => port.postMessage({ type: "stop-discovery" }));

port.onMessage.addListener((event: PanelEvent) => {
  if (event.type === "snapshot") {
    applySnapshot(event.snapshot);
    return;
  }

  if (event.type === "capture-added") {
    applySnapshot(event.snapshot);
    state.selectedId = event.capture.id;
    render();
  }
});

port.postMessage({ type: "get-snapshot" });

function applySnapshot(snapshot: PanelSnapshot): void {
  state.snapshot = snapshot;
  if (!state.selectedId && snapshot.captures[0]) {
    state.selectedId = snapshot.captures[0].id;
  }
  render();
}

function render(): void {
  const isActive = state.snapshot.state === "active";
  elements.statusBadge.textContent = isActive ? "发现中" : "未开始";
  elements.statusBadge.classList.toggle("active", isActive);
  elements.startButton.disabled = isActive;
  elements.stopButton.disabled = !isActive;
  elements.captureCount.textContent = String(state.snapshot.captures.length);

  renderList();
  renderDetail();
}

function renderList(): void {
  const captures = state.snapshot.captures;
  elements.requestList.innerHTML = "";

  if (captures.length === 0) {
    elements.requestList.className = "list-empty";
    elements.requestList.textContent = "还没有发现数据来源";
    return;
  }

  elements.requestList.className = "";

  captures.forEach((capture) => {
    const detection = summarizeResponse(capture.responseBody);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `request-item${capture.id === state.selectedId ? " active" : ""}`;
    button.addEventListener("click", () => {
      state.selectedId = capture.id;
      render();
    });

    const title = document.createElement("div");
    title.className = "request-title";
    title.textContent = readableUrl(capture.url);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.append(pill(capture.method), pill(String(capture.status)), pill(detection.looksLikeList ? "像列表数据" : "普通数据"));

    button.append(title, meta);
    elements.requestList.append(button);
  });
}

function renderDetail(): void {
  const capture = state.snapshot.captures.find((item) => item.id === state.selectedId);

  if (!capture) {
    elements.requestDetail.className = "empty-detail";
    elements.requestDetail.textContent = "点击「开始发现」，然后在页面里触发一次查询。";
    return;
  }

  const detection = summarizeResponse(capture.responseBody);
  const recipe = buildRecipeFromCapture(capture);

  elements.requestDetail.className = "";
  elements.requestDetail.innerHTML = "";
  elements.requestDetail.append(
    block("基础信息", keyValues([
      ["数据来源", capture.url],
      ["请求方式", capture.method],
      ["状态", String(capture.status)],
      ["发现时间", new Date(capture.capturedAt).toLocaleString()]
    ])),
    block("智能判断", findingList([
      detection.looksLikeList ? "看起来像列表数据" : "暂未判断为列表数据",
      detection.hasArray ? `包含数组：${detection.arrayPaths.join(", ")}` : "暂未发现数组",
      detection.keywordPaths.length > 0
        ? `可能包含总数、页码或列表字段：${detection.keywordPaths.join(", ")}`
        : "暂未发现 total / count / page / records / list 等字段"
    ])),
    block("查询条件", pre(JSON.stringify({ query: capture.query, body: capture.requestBody ?? {} }, null, 2))),
    block("返回预览", pre(capture.responsePreview || "无可展示内容")),
    recipeDraftBlock(recipe),
    advancedInfo(capture, recipe)
  );
}

function recipeDraftBlock(recipe: unknown): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "recipe-draft";

  const summary = document.createElement("div");
  summary.className = "finding";
  summary.textContent = "已根据当前数据来源生成一份可复用的数据技能草稿。";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "copy-button";
  copyButton.textContent = "复制 JSON";
  copyButton.addEventListener("click", () => {
    void copyText(JSON.stringify(recipe, null, 2), copyButton);
  });

  wrapper.append(summary, copyButton);
  return block("数据技能草稿", wrapper);
}

function advancedInfo(capture: CapturedRequest, recipe: unknown): HTMLElement {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "高级信息";
  const content = document.createElement("div");
  content.className = "detail-block";
  content.append(
    block("传输方式", keyValues([["类型", capture.transport]])),
    block("数据技能 JSON", pre(JSON.stringify(recipe, null, 2)))
  );
  details.append(summary, content);
  return details;
}

function block(titleText: string, content: HTMLElement): HTMLElement {
  const section = document.createElement("section");
  section.className = "detail-block";
  const title = document.createElement("h2");
  title.textContent = titleText;
  section.append(title, content);
  return section;
}

function keyValues(items: Array<[string, string]>): HTMLElement {
  const list = document.createElement("dl");
  list.className = "key-value";
  items.forEach(([key, value]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = value;
    wrapper.append(dt, dd);
    list.append(wrapper);
  });
  return list;
}

function findingList(items: string[]): HTMLElement {
  const container = document.createElement("div");
  container.className = "finding";
  items.forEach((item) => {
    const line = document.createElement("div");
    line.textContent = item;
    container.append(line);
  });
  return container;
}

function pre(text: string): HTMLElement {
  const element = document.createElement("pre");
  element.textContent = text;
  return element;
}

function pill(text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "pill";
  element.textContent = text;
  return element;
}

function readableUrl(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return urlValue;
  }
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

async function copyText(text: string, button: HTMLButtonElement): Promise<void> {
  const originalText = button.textContent ?? "复制 JSON";

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "已复制";
  } catch {
    button.textContent = "复制失败";
  }

  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1600);
}
