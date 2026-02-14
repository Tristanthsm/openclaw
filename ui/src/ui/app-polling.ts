import type { OpenClawApp } from "./app.ts";
import { loadDebug } from "./controllers/debug.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadClipStudioStatus } from "./controllers/work-clips.ts";

type PollingHost = {
  nodesPollInterval: number | null;
  logsPollInterval: number | null;
  debugPollInterval: number | null;
  workClipsPollInterval: number | null;
  tab: string;
  workClipsJobId?: string | null;
  workClipsStatus?: { state?: string | null } | null;
};

export function startNodesPolling(host: PollingHost) {
  if (host.nodesPollInterval != null) {
    return;
  }
  host.nodesPollInterval = window.setInterval(
    () => void loadNodes(host as unknown as OpenClawApp, { quiet: true }),
    5000,
  );
}

export function stopNodesPolling(host: PollingHost) {
  if (host.nodesPollInterval == null) {
    return;
  }
  clearInterval(host.nodesPollInterval);
  host.nodesPollInterval = null;
}

export function startLogsPolling(host: PollingHost) {
  if (host.logsPollInterval != null) {
    return;
  }
  host.logsPollInterval = window.setInterval(() => {
    if (host.tab !== "logs") {
      return;
    }
    void loadLogs(host as unknown as OpenClawApp, { quiet: true });
  }, 2000);
}

export function stopLogsPolling(host: PollingHost) {
  if (host.logsPollInterval == null) {
    return;
  }
  clearInterval(host.logsPollInterval);
  host.logsPollInterval = null;
}

export function startDebugPolling(host: PollingHost) {
  if (host.debugPollInterval != null) {
    return;
  }
  host.debugPollInterval = window.setInterval(() => {
    if (host.tab !== "debug") {
      return;
    }
    void loadDebug(host as unknown as OpenClawApp);
  }, 3000);
}

export function stopDebugPolling(host: PollingHost) {
  if (host.debugPollInterval == null) {
    return;
  }
  clearInterval(host.debugPollInterval);
  host.debugPollInterval = null;
}

function shouldPollWorkClips(host: PollingHost) {
  if (host.tab !== "clipStudio") {
    return false;
  }
  const jobId = (host.workClipsJobId ?? "").trim();
  if (!jobId) {
    return false;
  }
  const state = host.workClipsStatus?.state ?? null;
  // Keep polling while queued/running/unknown.
  return state !== "done" && state !== "error";
}

export function startWorkClipsPolling(host: PollingHost) {
  if (host.workClipsPollInterval != null) {
    return;
  }
  host.workClipsPollInterval = window.setInterval(() => {
    if (!shouldPollWorkClips(host)) {
      // Stop the interval once the job is done/errored or user left the tab.
      stopWorkClipsPolling(host);
      return;
    }
    void loadClipStudioStatus(host as unknown as OpenClawApp);
  }, 2500);
}

export function stopWorkClipsPolling(host: PollingHost) {
  if (host.workClipsPollInterval == null) {
    return;
  }
  clearInterval(host.workClipsPollInterval);
  host.workClipsPollInterval = null;
}
