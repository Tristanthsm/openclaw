import type { UiSettings } from "../storage.ts";

export type ClipAsset = {
  id?: string;
  title?: string;
  hook?: string;
  startSec?: number;
  endSec?: number;
  downloadUrl?: string;
  captionsUrl?: string;
  score?: number;
};

export type ClipStudioJobStatus = {
  ok: boolean;
  ts?: string;
  op?: "create" | "status";
  jobId?: string;
  state?: "queued" | "running" | "done" | "error";
  progress?: number; // 0..100
  clips?: ClipAsset[];
  error?: { type?: string; status?: number | null; message?: string };
  meta?: unknown;
};

export type WorkClipsState = {
  settings: UiSettings;
  workClipsLoading: boolean;
  workClipsError: string | null;
  workClipsLastFetchAt: number | null;
  workClipsVideoUrl: string;
  workClipsJobId: string | null;
  workClipsStatus: ClipStudioJobStatus | null;
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
  const hook = normalizePathSegment(settings.workClipRouterWebhookPath, "/webhook/cmd-clip-studio");
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

export async function loadClipStudioStatus(state: WorkClipsState) {
  if (state.workClipsLoading) {
    return;
  }
  state.workClipsLoading = true;
  state.workClipsError = null;
  try {
    const url = resolveRouterUrl(state.settings);
    const payload = {
      op: "status",
      jobId: state.workClipsJobId ?? undefined,
    };
    const res = await postJson(url, payload);
    if (!res.ok) {
      throw new Error(`Clip studio status failed (${res.status})`);
    }
    const data = res.data as ClipStudioJobStatus;
    state.workClipsStatus = data;
    state.workClipsLastFetchAt = Date.now();
  } catch (err) {
    state.workClipsError = String(err);
  } finally {
    state.workClipsLoading = false;
  }
}

export async function createClipStudioJob(state: WorkClipsState) {
  if (state.workClipsLoading) {
    return;
  }
  const videoUrl = (state.workClipsVideoUrl || "").trim();
  if (!videoUrl) {
    state.workClipsError = "Missing video URL.";
    return;
  }

  state.workClipsLoading = true;
  state.workClipsError = null;
  state.workClipsStatus = null;
  try {
    const url = resolveRouterUrl(state.settings);
    const payload = {
      op: "create",
      videoUrl,
      // TikTok defaults (backend may ignore unknown fields safely).
      maxClips: state.settings.workClipMaxClips,
      minSeconds: state.settings.workClipMinSeconds,
      maxSeconds: state.settings.workClipMaxSeconds,
      subtitleStyle: state.settings.workClipSubtitleStyle,
      format: "tiktok",
    };
    const res = await postJson(url, payload);
    if (!res.ok) {
      throw new Error(`Clip studio create failed (${res.status})`);
    }
    const data = res.data as ClipStudioJobStatus;
    if (data?.jobId) {
      state.workClipsJobId = String(data.jobId);
    }
    state.workClipsStatus = data;
    state.workClipsLastFetchAt = Date.now();
  } catch (err) {
    state.workClipsError = String(err);
  } finally {
    state.workClipsLoading = false;
  }
}
