import type { CapturedRequest } from "@data-recipe/detector";
import type { PanelEvent, PanelMessage, PanelSnapshot, RuntimeMessage, TabControlMessage } from "./messages";

const tabCaptures = new Map<number, CapturedRequest[]>();
const activeTabs = new Set<number>();
const panelPorts = new Set<chrome.runtime.Port>();

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
  if (message.type !== "captured-request" || !sender.tab?.id) {
    return;
  }

  const tabId = sender.tab.id;
  const captures = tabCaptures.get(tabId) ?? [];
  captures.unshift(message.capture);
  tabCaptures.set(tabId, captures.slice(0, 100));

  broadcast({
    type: "capture-added",
    capture: message.capture,
    snapshot: createSnapshot(tabId)
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "data-recipe-sidepanel") {
    return;
  }

  panelPorts.add(port);
  port.onDisconnect.addListener(() => panelPorts.delete(port));
  port.onMessage.addListener((message: PanelMessage) => {
    void handlePanelMessage(port, message);
  });

  void sendSnapshot(port);
});

async function handlePanelMessage(port: chrome.runtime.Port, message: PanelMessage): Promise<void> {
  const tabId = await getActiveTabId();

  if (message.type === "get-snapshot") {
    send(port, { type: "snapshot", snapshot: createSnapshot(tabId) });
    return;
  }

  if (!tabId) {
    send(port, { type: "snapshot", snapshot: createSnapshot(null) });
    return;
  }

  if (message.type === "start-discovery") {
    activeTabs.add(tabId);
    await sendControlMessage(tabId, { type: "start-discovery" });
    send(port, { type: "snapshot", snapshot: createSnapshot(tabId) });
    return;
  }

  if (message.type === "stop-discovery") {
    activeTabs.delete(tabId);
    await sendControlMessage(tabId, { type: "stop-discovery" });
    send(port, { type: "snapshot", snapshot: createSnapshot(tabId) });
    return;
  }

  if (message.type === "clear-captures") {
    tabCaptures.set(tabId, []);
    send(port, { type: "snapshot", snapshot: createSnapshot(tabId) });
  }
}

async function sendSnapshot(port: chrome.runtime.Port): Promise<void> {
  const tabId = await getActiveTabId();
  send(port, { type: "snapshot", snapshot: createSnapshot(tabId) });
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function sendControlMessage(tabId: number, message: TabControlMessage): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.global.js"]
    });
    await chrome.tabs.sendMessage(tabId, message);
  }
}

function createSnapshot(tabId: number | null): PanelSnapshot {
  return {
    tabId,
    state: tabId && activeTabs.has(tabId) ? "active" : "idle",
    captures: tabId ? tabCaptures.get(tabId) ?? [] : []
  };
}

function broadcast(event: PanelEvent): void {
  panelPorts.forEach((port) => send(port, event));
}

function send(port: chrome.runtime.Port, event: PanelEvent): void {
  try {
    port.postMessage(event);
  } catch {
    panelPorts.delete(port);
  }
}
