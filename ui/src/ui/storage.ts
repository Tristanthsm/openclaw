const KEY = "openclaw.control.settings.v1";

import type { ThemeMode } from "./theme.ts";

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeMode;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
  workSearchUiMode: "quick" | "assistant"; // UI mode for Search & Quotas
  workN8nBasePath: string; // Base path for the local n8n instance (defaults to /n8n)
  workSearchRouterWebhookPath: string; // Webhook path under the n8n base (defaults to /webhook/cmd-search-router)
  workSearchStrictFree: boolean; // Force router to respect internal free-tier caps
  workSearchProvider: "auto" | "brave" | "tavily";
  workSearchMode: "serp" | "deep";
  workSearchMaxResults: number; // 1..20 (clamped in router as well)
  workSearchDomains: string; // Comma-separated domain allowlist
  workClipRouterWebhookPath: string; // Webhook path under the n8n base (defaults to /webhook/cmd-clip-studio)
  workClipMaxClips: number; // 1..20
  workClipMinSeconds: number; // 5..120
  workClipMaxSeconds: number; // 10..180
  workClipSubtitleStyle: "karaoke" | "clean";
};

export function loadSettings(): UiSettings {
  const defaultUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}`;
  })();

  const defaults: UiSettings = {
    gatewayUrl: defaultUrl,
    token: "",
    sessionKey: "main",
    lastActiveSessionKey: "main",
    theme: "system",
    chatFocusMode: false,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: false,
    navGroupsCollapsed: {},
    workSearchUiMode: "quick",
    workN8nBasePath: "/n8n",
    workSearchRouterWebhookPath: "/webhook/cmd-search-router",
    workSearchStrictFree: true,
    workSearchProvider: "auto",
    workSearchMode: "serp",
    workSearchMaxResults: 10,
    workSearchDomains: "",
    workClipRouterWebhookPath: "/webhook/cmd-clip-studio",
    workClipMaxClips: 10,
    workClipMinSeconds: 15,
    workClipMaxSeconds: 45,
    workClipSubtitleStyle: "karaoke",
  };

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    const workProvider =
      parsed.workSearchProvider === "brave" ||
      parsed.workSearchProvider === "tavily" ||
      parsed.workSearchProvider === "auto"
        ? parsed.workSearchProvider
        : defaults.workSearchProvider;
    const workMode =
      parsed.workSearchMode === "deep" || parsed.workSearchMode === "serp"
        ? parsed.workSearchMode
        : defaults.workSearchMode;
    const workN8nBasePath =
      typeof parsed.workN8nBasePath === "string" && parsed.workN8nBasePath.trim()
        ? parsed.workN8nBasePath.trim()
        : defaults.workN8nBasePath;
    const workWebhookPath =
      typeof parsed.workSearchRouterWebhookPath === "string" &&
      parsed.workSearchRouterWebhookPath.trim()
        ? parsed.workSearchRouterWebhookPath.trim()
        : defaults.workSearchRouterWebhookPath;
    const workClipWebhookPath =
      typeof parsed.workClipRouterWebhookPath === "string" &&
      parsed.workClipRouterWebhookPath.trim()
        ? parsed.workClipRouterWebhookPath.trim()
        : defaults.workClipRouterWebhookPath;
    const workSearchUiMode =
      parsed.workSearchUiMode === "assistant" || parsed.workSearchUiMode === "quick"
        ? parsed.workSearchUiMode
        : defaults.workSearchUiMode;
    const workMaxResults =
      typeof parsed.workSearchMaxResults === "number" &&
      Number.isFinite(parsed.workSearchMaxResults)
        ? Math.min(20, Math.max(1, Math.floor(parsed.workSearchMaxResults)))
        : defaults.workSearchMaxResults;
    const workClipMaxClips =
      typeof parsed.workClipMaxClips === "number" && Number.isFinite(parsed.workClipMaxClips)
        ? Math.min(20, Math.max(1, Math.floor(parsed.workClipMaxClips)))
        : defaults.workClipMaxClips;
    const workClipMinSeconds =
      typeof parsed.workClipMinSeconds === "number" && Number.isFinite(parsed.workClipMinSeconds)
        ? Math.min(120, Math.max(5, Math.floor(parsed.workClipMinSeconds)))
        : defaults.workClipMinSeconds;
    const workClipMaxSeconds =
      typeof parsed.workClipMaxSeconds === "number" && Number.isFinite(parsed.workClipMaxSeconds)
        ? Math.min(180, Math.max(10, Math.floor(parsed.workClipMaxSeconds)))
        : defaults.workClipMaxSeconds;
    const workClipSubtitleStyle =
      parsed.workClipSubtitleStyle === "clean" || parsed.workClipSubtitleStyle === "karaoke"
        ? parsed.workClipSubtitleStyle
        : defaults.workClipSubtitleStyle;
    return {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      token: typeof parsed.token === "string" ? parsed.token : defaults.token,
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : defaults.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" && parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : (typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()) ||
            defaults.lastActiveSessionKey,
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : defaults.theme,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean" ? parsed.chatFocusMode : defaults.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : defaults.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : defaults.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean" ? parsed.navCollapsed : defaults.navCollapsed,
      navGroupsCollapsed:
        typeof parsed.navGroupsCollapsed === "object" && parsed.navGroupsCollapsed !== null
          ? parsed.navGroupsCollapsed
          : defaults.navGroupsCollapsed,
      workSearchUiMode,
      workN8nBasePath,
      workSearchRouterWebhookPath: workWebhookPath,
      workSearchStrictFree:
        typeof parsed.workSearchStrictFree === "boolean"
          ? parsed.workSearchStrictFree
          : defaults.workSearchStrictFree,
      workSearchProvider: workProvider,
      workSearchMode: workMode,
      workSearchMaxResults: workMaxResults,
      workSearchDomains:
        typeof parsed.workSearchDomains === "string"
          ? parsed.workSearchDomains
          : defaults.workSearchDomains,
      workClipRouterWebhookPath: workClipWebhookPath,
      workClipMaxClips,
      workClipMinSeconds,
      workClipMaxSeconds,
      workClipSubtitleStyle,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(next: UiSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
