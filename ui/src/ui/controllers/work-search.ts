import type { UiSettings } from "../storage.ts";

export type SearchRouterQuota = {
  period?: string;
  used?: number;
  limit?: number;
  remaining?: number | null;
};

export type SearchRouterStatus = {
  ok: true;
  ts: string;
  op: "status";
  quotas: {
    brave?: { monthly?: SearchRouterQuota; daily?: SearchRouterQuota };
    tavily?: { monthly?: SearchRouterQuota; daily?: SearchRouterQuota };
    cooldown?: { brave?: unknown; tavily?: unknown };
    resetsAt?: { dayUtc?: string; monthUtc?: string };
  };
  limits: {
    strictFreeDefault?: boolean;
    brave?: { monthlyLimit?: number; dailyLimit?: number; minIntervalMs?: number };
    tavily?: { monthlyLimit?: number; dailyLimit?: number; minIntervalMs?: number };
    providerCooldownMs?: number;
    providerAuthCooldownMs?: number;
    cacheTtlMs?: number;
    maxCacheEntries?: number;
  };
  stats?: {
    executions?: number;
    cacheHits?: number;
    providerCalls?: number;
    httpErrors?: number;
    authErrors?: number;
  };
  dlq?: { size?: number; tail?: unknown[] };
};

export type SearchRouterResult = {
  ok: boolean;
  ts?: string;
  providerUsed?: string | null;
  resolvedQuery?: string;
  results?: Array<{ title?: string; url?: string; snippet?: string; source?: string }>;
  error?: { type?: string; status?: number | null; message?: string };
  meta?: unknown;
};

export type WorkSearchState = {
  settings: UiSettings;
  workSearchLoading: boolean;
  workSearchError: string | null;
  workSearchStatus: SearchRouterStatus | null;
  workSearchLastFetchAt: number | null;
  workSearchTestQuery: string;
  workSearchTestLoading: boolean;
  workSearchTestError: string | null;
  workSearchTestResponse: SearchRouterResult | null;
};

function normalizePathSegment(value: string, fallback: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function joinPaths(base: string, suffix: string) {
  const a = normalizePathSegment(base, "");
  const b = normalizePathSegment(suffix, "");
  if (!a) {
    return b || "/";
  }
  if (!b) {
    return a;
  }
  return `${a.replace(/\/$/, "")}/${b.replace(/^\//, "")}`;
}

function resolveRouterUrl(settings: UiSettings) {
  const base = normalizePathSegment(settings.workN8nBasePath, "/n8n");
  const hook = normalizePathSegment(
    settings.workSearchRouterWebhookPath,
    "/webhook/cmd-search-router",
  );
  return joinPaths(base, hook);
}

async function postJson(url: string, payload: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

export async function loadSearchRouterStatus(state: WorkSearchState) {
  if (state.workSearchLoading) {
    return;
  }
  state.workSearchLoading = true;
  state.workSearchError = null;
  try {
    const url = resolveRouterUrl(state.settings);
    const payload = {
      op: "status",
      provider: "auto",
      strictFree: Boolean(state.settings.workSearchStrictFree),
    };
    const res = await postJson(url, payload);
    if (!res.ok) {
      throw new Error(`Search router status failed (${res.status})`);
    }
    const data = res.data as SearchRouterStatus;
    if (!data || data.ok !== true || data.op !== "status") {
      throw new Error("Unexpected search router status payload");
    }
    state.workSearchStatus = data;
    state.workSearchLastFetchAt = Date.now();
  } catch (err) {
    state.workSearchError = String(err);
  } finally {
    state.workSearchLoading = false;
  }
}

export async function runSearchRouterQuery(state: WorkSearchState, queryOverride?: string) {
  if (state.workSearchTestLoading) {
    return;
  }
  const query = (queryOverride ?? state.workSearchTestQuery ?? "").trim();
  if (!query) {
    state.workSearchTestError = "Missing query.";
    return;
  }

  state.workSearchTestLoading = true;
  state.workSearchTestError = null;
  state.workSearchTestResponse = null;
  try {
    const url = resolveRouterUrl(state.settings);
    const domains = String(state.settings.workSearchDomains || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);
    const payload = {
      query,
      provider: state.settings.workSearchProvider,
      mode: state.settings.workSearchMode,
      strictFree: Boolean(state.settings.workSearchStrictFree),
      maxResults: state.settings.workSearchMaxResults,
      domains: domains.length ? domains : undefined,
    };
    const res = await postJson(url, payload);
    if (!res.ok) {
      throw new Error(`Search router query failed (${res.status})`);
    }
    const data = res.data as SearchRouterResult;
    state.workSearchTestResponse = data;
    if (!data || data.ok !== true) {
      state.workSearchTestError = data?.error?.message || "Search returned an error.";
    }
  } catch (err) {
    state.workSearchTestError = String(err);
  } finally {
    state.workSearchTestLoading = false;
  }

  // Keep quotas in sync after running a query (helps explain why a provider suddenly blocks).
  // This is a status-only call (op=status) so it does not burn provider credits.
  try {
    await loadSearchRouterStatus(state);
  } catch {
    // Ignore status refresh errors; test result is still valid.
  }
}
