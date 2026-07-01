import { buildRecipeFromCapture, summarizeResponse, type CapturedRequest } from "@data-recipe/detector";
import { runRecipeOnSample } from "@data-recipe/recipe-runner";
import { buildDataSkillPackage, type DataSkillPackage } from "@data-recipe/skill-builder";
import { exportDataSkillPackageAsJson, validateDataSkillPackage } from "@data-recipe/skill-exporter";
import type { PanelEvent, PanelSnapshot } from "./messages";

interface RecipeMetadata {
  displayName?: string;
  description?: string;
  useCases?: string[];
}
const FIELD_LABELS_STORAGE_KEY = "dataRecipeFieldLabels";
const RECIPE_META_STORAGE_KEY = "dataRecipeMetadata";

const port = chrome.runtime.connect({ name: "data-recipe-sidepanel" });

const state: {
  snapshot: PanelSnapshot;
  selectedId: string | null;
  fieldLabels: Record<string, Record<string, string>>;
  recipeMetadata: Record<string, RecipeMetadata>;
} = {
  snapshot: {
    tabId: null,
    state: "idle",
    captures: []
  },
  selectedId: null,
  fieldLabels: {},
  recipeMetadata: {}
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

void loadStoredEdits();
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
  const recipe = applyRecipeEdits(capture.url, buildRecipeFromCapture(capture));
  const runResult = runRecipeOnSample(recipe, capture.responseBody);
  const skillPackage = buildDataSkillPackage({ recipe, userGoal: recipe.description });

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
    parameterPreviewBlock(recipe),
    fieldPreviewBlock(recipe),
    block("返回预览", pre(capture.responsePreview || "无可展示内容")),
    recipeMetadataBlock(recipe),
    recipeDraftBlock(recipe),
    skillPackageBlock(skillPackage),
    runPreviewBlock(runResult),
    advancedInfo(capture, recipe)
  );
}

function applyRecipeEdits(sourceKey: string, recipe: ReturnType<typeof buildRecipeFromCapture>): ReturnType<typeof buildRecipeFromCapture> {
  const labels = state.fieldLabels[sourceKey] ?? {};
  const metadata = state.recipeMetadata[sourceKey];
  return {
    ...recipe,
    displayName: metadata?.displayName ?? recipe.displayName,
    description: metadata?.description ?? recipe.description,
    useCases: metadata?.useCases?.length ? metadata.useCases : recipe.useCases,
    fields: recipe.fields.map((field) => ({
      ...field,
      displayName: labels[field.path] ?? field.displayName,
      description: labels[field.path] ? "用户确认" : field.description
    }))
  };
}
function parameterPreviewBlock(recipe: ReturnType<typeof buildRecipeFromCapture>): HTMLElement {
  const parameters = [...recipe.request.queryFields, ...recipe.request.bodyFields];

  if (parameters.length === 0) {
    return block("查询条件说明", findingList(["暂未发现明确的查询条件。"]));
  }

  return block(
    "查询条件说明",
    findingList(parameters.slice(0, 12).map((item) => `${item.displayName}：${item.type}${item.sample === undefined ? "" : `，样例 ${formatInlineValue(item.sample)}`}`))
  );
}

function fieldPreviewBlock(recipe: ReturnType<typeof buildRecipeFromCapture>): HTMLElement {
  if (recipe.fields.length === 0 || !state.selectedId) {
    return block("返回字段", findingList(["暂未从当前数据中识别出稳定字段。"]));
  }

  const wrapper = document.createElement("div");
  wrapper.className = "field-editor";

  recipe.fields.slice(0, 16).forEach((field) => {
    const row = document.createElement("label");
    row.className = "field-row";

    const input = document.createElement("input");
    input.value = field.displayName;
    input.placeholder = field.name;
    input.addEventListener("input", () => {
      const sourceKey = recipe.source.apiUrl;
      const labels = state.fieldLabels[sourceKey] ?? {};
      const label = input.value.trim() || field.name;
      labels[field.path] = label;
      state.fieldLabels[sourceKey] = labels;
      field.displayName = label;
      field.description = "用户确认";
      void saveStoredEdits();
    });

    const meta = document.createElement("span");
    meta.textContent = `${field.name} · ${field.type}${field.sample === undefined ? "" : ` · 样例 ${formatInlineValue(field.sample)}`}`;

    row.append(input, meta);
    wrapper.append(row);
  });

  return block("返回字段", wrapper);
}

function recipeMetadataBlock(recipe: ReturnType<typeof buildRecipeFromCapture>): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "skill-editor";

  const nameLabel = document.createElement("label");
  nameLabel.className = "skill-field";
  const nameTitle = document.createElement("span");
  nameTitle.textContent = "数据技能名称";
  const nameInput = document.createElement("input");
  nameInput.value = recipe.displayName;
  nameInput.addEventListener("input", () => {
    const metadata = state.recipeMetadata[recipe.source.apiUrl] ?? {};
    metadata.displayName = nameInput.value.trim() || "数据来源";
    state.recipeMetadata[recipe.source.apiUrl] = metadata;
    recipe.displayName = metadata.displayName;
    void saveStoredEdits();
  });
  nameLabel.append(nameTitle, nameInput);

  const descriptionLabel = document.createElement("label");
  descriptionLabel.className = "skill-field";
  const descriptionTitle = document.createElement("span");
  descriptionTitle.textContent = "用途说明";
  const descriptionInput = document.createElement("textarea");
  descriptionInput.rows = 3;
  descriptionInput.value = recipe.description;
  descriptionInput.addEventListener("input", () => {
    const metadata = state.recipeMetadata[recipe.source.apiUrl] ?? {};
    metadata.description = descriptionInput.value.trim();
    metadata.useCases = splitUseCases(descriptionInput.value);
    state.recipeMetadata[recipe.source.apiUrl] = metadata;
    recipe.description = metadata.description ?? "";
    recipe.useCases = metadata.useCases ?? [];
    void saveStoredEdits();
  });
  descriptionLabel.append(descriptionTitle, descriptionInput);

  wrapper.append(nameLabel, descriptionLabel);
  return block("数据技能信息", wrapper);
}
function skillPackageBlock(skillPackage: DataSkillPackage): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "skill-package";

  const validation = validateDataSkillPackage(skillPackage);
  const summary = document.createElement("div");
  summary.className = "finding";
  summary.textContent = validation.ok
    ? `已生成 ${skillPackage.files.length} 个文件，技能包可以导出。`
    : `技能包还缺少：${validation.missingFiles.join("、")}`;

  const actions = document.createElement("div");
  actions.className = "package-actions";

  const skillFile = skillPackage.files.find((file) => file.path === "SKILL.md");
  const recipeFile = skillPackage.files.find((file) => file.path === "recipe.json");

  actions.append(exportPackageButton(skillPackage));

  if (skillFile) {
    actions.append(copyContentButton("复制 SKILL.md", skillFile.content));
  }
  if (recipeFile) {
    actions.append(copyContentButton("复制 recipe.json", recipeFile.content));
  }

  const details = document.createElement("details");
  const detailsSummary = document.createElement("summary");
  detailsSummary.textContent = "预览 SKILL.md";
  details.append(detailsSummary, pre(skillFile?.content ?? "暂未生成 SKILL.md"));

  wrapper.append(summary, actions, details);
  return block("技能包预览", wrapper);
}

function exportPackageButton(skillPackage: DataSkillPackage): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary";
  button.textContent = "导出技能包";
  button.addEventListener("click", () => {
    downloadTextFile(exportDataSkillPackageAsJson(skillPackage));
  });
  return button;
}

function downloadTextFile(file: ReturnType<typeof exportDataSkillPackageAsJson>): void {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
function copyContentButton(label: string, content: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button";
  button.textContent = label;
  button.addEventListener("click", () => {
    void copyText(content, button);
  });
  return button;
}
function runPreviewBlock(runResult: ReturnType<typeof runRecipeOnSample>): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "run-preview";

  const summary = document.createElement("div");
  summary.className = "finding";
  summary.textContent = runResult.message;
  wrapper.append(summary);

  if (runResult.previewRows.length > 0) {
    wrapper.append(pre(JSON.stringify(runResult.previewRows, null, 2)));
  }

  return block("试运行结果", wrapper);
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

async function loadStoredEdits(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([FIELD_LABELS_STORAGE_KEY, RECIPE_META_STORAGE_KEY]);
    const labels = stored[FIELD_LABELS_STORAGE_KEY];
    const metadata = stored[RECIPE_META_STORAGE_KEY];
    if (labels && typeof labels === "object" && !Array.isArray(labels)) {
      state.fieldLabels = labels as Record<string, Record<string, string>>;
    }
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      state.recipeMetadata = metadata as Record<string, RecipeMetadata>;
    }
    render();
  } catch {
    // Local edits remain usable even if extension storage is unavailable.
  }
}

async function saveStoredEdits(): Promise<void> {
  try {
    await chrome.storage.local.set({
      [FIELD_LABELS_STORAGE_KEY]: state.fieldLabels,
      [RECIPE_META_STORAGE_KEY]: state.recipeMetadata
    });
  } catch {
    // The current in-memory edit is still reflected in the copied draft.
  }
}
function splitUseCases(value: string): string[] {
  return value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}
function formatInlineValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) {
    return "空";
  }
  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
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

