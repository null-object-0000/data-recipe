import type { CapturedRequest } from "@data-recipe/detector";

export type DiscoveryState = "idle" | "active";

export interface PanelSnapshot {
  tabId: number | null;
  state: DiscoveryState;
  captures: CapturedRequest[];
}

export type RuntimeMessage =
  | { type: "captured-request"; capture: CapturedRequest }
  | { type: "content-ready" };

export type TabControlMessage =
  | { type: "start-discovery" }
  | { type: "stop-discovery" };

export type PanelMessage =
  | { type: "get-snapshot" }
  | { type: "start-discovery" }
  | { type: "stop-discovery" }
  | { type: "clear-captures" };

export type PanelEvent =
  | { type: "snapshot"; snapshot: PanelSnapshot }
  | { type: "capture-added"; capture: CapturedRequest; snapshot: PanelSnapshot };

export interface PageCapturedMessage {
  source: "data-recipe-page-hook";
  type: "captured-request";
  payload: Omit<CapturedRequest, "id" | "pageUrl" | "query" | "capturedAt">;
}

export interface PageControlMessage {
  source: "data-recipe-content";
  type: "start-discovery" | "stop-discovery";
}
