import { html, nothing } from "lit";
import type { ClipAsset, ClipStudioJobStatus } from "../controllers/work-clips.ts";
import type { UiSettings } from "../storage.ts";
import { formatRelativeTimestamp } from "../format.ts";

export type WorkClipsProps = {
  settings: UiSettings;
  loading: boolean;
  error: string | null;
  lastFetchAt: number | null;
  videoUrl: string;
  jobId: string | null;
  status: ClipStudioJobStatus | null;
  onSettingsChange: (next: UiSettings) => void;
  onVideoUrlChange: (next: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onClear: () => void;
};

function summarizeClipperError(raw: string) {
  const msg = String(raw || "").trim();
  if (!msg) {
    return { title: "Erreur", detail: "", hint: null as string | null };
  }
  if (msg.includes("Sign in to confirm") || msg.toLowerCase().includes("not a bot")) {
    return {
      title: "YouTube bloque l'extraction (verification anti-bot)",
      detail: msg,
      hint: "Solution: fournir des cookies YouTube au clipper (fichier sur le VPS, jamais dans le chat). Sans cookies, certains liens YouTube echouent.",
    };
  }
  if (
    msg.includes("No supported JavaScript runtime could be found") ||
    msg.includes("js-runtimes")
  ) {
    return {
      title: "yt-dlp a besoin d'un runtime JS (Deno/Node)",
      detail: msg,
      hint: "Solution: installer Deno dans le conteneur clipper et utiliser --js-runtimes (on peut le faire cote VPS).",
    };
  }
  return { title: "Erreur clipper", detail: msg, hint: null as string | null };
}

function renderClip(clip: ClipAsset, i: number) {
  const title = clip.title || `Clip ${i + 1}`;
  const range =
    typeof clip.startSec === "number" && typeof clip.endSec === "number"
      ? `${Math.round(clip.startSec)}s → ${Math.round(clip.endSec)}s`
      : null;
  return html`
    <div class="callout" style="margin-top: 10px;">
      <div class="row" style="justify-content: space-between; gap: 10px;">
        <div>
          <div style="font-weight: 600;">${title}</div>
          <div class="muted" style="margin-top: 4px;">
            ${range ? html`<span class="mono">${range}</span>` : nothing}
            ${typeof clip.score === "number" ? html` · Score <span class="mono">${Math.round(clip.score)}</span>` : nothing}
          </div>
        </div>
        <div class="row" style="gap: 8px; align-items: flex-start;">
          ${
            clip.hook
              ? html`<button
                  class="btn"
                  @click=${async () => {
                    try {
                      await navigator.clipboard.writeText(String(clip.hook || ""));
                    } catch {
                      // Ignore clipboard errors (permissions / insecure context).
                    }
                  }}
                >
                  Copy hook
                </button>`
              : nothing
          }
          ${
            clip.captionsUrl
              ? html`<a class="btn" href=${clip.captionsUrl} target="_blank" rel="noreferrer">Captions</a>`
              : nothing
          }
          ${
            clip.downloadUrl
              ? html`<a class="btn" href=${clip.downloadUrl} target="_blank" rel="noreferrer">Download</a>`
              : nothing
          }
        </div>
      </div>
      ${
        clip.downloadUrl
          ? html`<video
              style="width: 100%; margin-top: 12px; border-radius: 14px; background: #000;"
              controls
              preload="metadata"
              src=${clip.downloadUrl}
            ></video>`
          : nothing
      }
      ${
        clip.hook
          ? html`<div style="margin-top: 10px;"><span class="muted">Hook:</span> ${clip.hook}</div>`
          : nothing
      }
    </div>
  `;
}

export function renderWorkClips(props: WorkClipsProps) {
  const status = props.status;
  const state = status?.state ?? null;
  const isStatusError = status?.ok === false;
  const displayState = isStatusError ? "error" : state;
  const progress = typeof status?.progress === "number" ? Math.round(status.progress) : null;
  const clips = Array.isArray(status?.clips) ? status?.clips : [];
  const pollingActive = Boolean(
    props.jobId && !isStatusError && state !== "done" && state !== "error",
  );
  const clipperErr = status?.error?.message ? summarizeClipperError(status.error.message) : null;

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Clip Studio</div>
        <div class="card-sub">Colle un lien video et genere des clips TikTok (sous-titres + hooks).</div>

        ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}

        <div class="row" style="margin-top: 12px; gap: 10px; align-items: flex-end;">
          <label class="field" style="flex: 1;">
            <span>Video URL</span>
            <input
              .value=${props.videoUrl}
              placeholder="https://..."
              @input=${(e: Event) => props.onVideoUrlChange((e.target as HTMLInputElement).value)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" && !props.loading) {
                  props.onCreate();
                }
              }}
            />
          </label>
          <button class="btn" ?disabled=${props.loading} @click=${() => props.onCreate()}>
            ${props.loading ? "Working..." : "Generate"}
          </button>
          <button class="btn" ?disabled=${props.loading} @click=${() => props.onClear()}>
            Clear
          </button>
        </div>

        <details style="margin-top: 14px;">
          <summary class="muted" style="cursor: pointer;">Advanced</summary>
          <div class="form-grid" style="margin-top: 12px;">
            <label class="field">
              <span>Max clips</span>
              <input
                type="number"
                min="1"
                max="20"
                .value=${String(props.settings.workClipMaxClips)}
                @input=${(e: Event) => {
                  const raw = (e.target as HTMLInputElement).value;
                  const n = Math.min(20, Math.max(1, Math.floor(Number(raw || 10))));
                  props.onSettingsChange({ ...props.settings, workClipMaxClips: n });
                }}
              />
            </label>
            <label class="field">
              <span>Min seconds</span>
              <input
                type="number"
                min="5"
                max="120"
                .value=${String(props.settings.workClipMinSeconds)}
                @input=${(e: Event) => {
                  const raw = (e.target as HTMLInputElement).value;
                  const n = Math.min(120, Math.max(5, Math.floor(Number(raw || 15))));
                  props.onSettingsChange({ ...props.settings, workClipMinSeconds: n });
                }}
              />
            </label>
            <label class="field">
              <span>Max seconds</span>
              <input
                type="number"
                min="10"
                max="180"
                .value=${String(props.settings.workClipMaxSeconds)}
                @input=${(e: Event) => {
                  const raw = (e.target as HTMLInputElement).value;
                  const n = Math.min(180, Math.max(10, Math.floor(Number(raw || 45))));
                  props.onSettingsChange({ ...props.settings, workClipMaxSeconds: n });
                }}
              />
            </label>
            <label class="field">
              <span>Subtitle style</span>
              <select
                .value=${props.settings.workClipSubtitleStyle}
                @change=${(e: Event) => {
                  const v = (e.target as HTMLSelectElement).value === "clean" ? "clean" : "karaoke";
                  props.onSettingsChange({ ...props.settings, workClipSubtitleStyle: v });
                }}
              >
                <option value="karaoke">karaoke</option>
                <option value="clean">clean</option>
              </select>
            </label>
            <label class="field">
              <span>n8n base path</span>
              <input
                .value=${props.settings.workN8nBasePath}
                placeholder="/n8n"
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  props.onSettingsChange({ ...props.settings, workN8nBasePath: v });
                }}
              />
            </label>
            <label class="field">
              <span>Webhook path</span>
              <input
                .value=${props.settings.workClipRouterWebhookPath}
                placeholder="/webhook/cmd-clip-studio"
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  props.onSettingsChange({ ...props.settings, workClipRouterWebhookPath: v });
                }}
              />
            </label>
          </div>
        </details>

        <div class="row" style="margin-top: 14px;">
          <button class="btn" ?disabled=${props.loading} @click=${() => props.onRefresh()}>
            ${props.loading ? "Refreshing..." : "Refresh status"}
          </button>
          <div class="muted">
            ${props.lastFetchAt ? html`Last: ${formatRelativeTimestamp(props.lastFetchAt)}` : nothing}
          </div>
        </div>

        <div class="callout" style="margin-top: 12px;">
          <div class="muted">
            Backend: n8n workflow attendu sur <span class="mono">${props.settings.workN8nBasePath}${props.settings.workClipRouterWebhookPath}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Job</div>
        <div class="card-sub">Etat + progression.</div>

        <div class="callout" style="margin-top: 14px;">
          <div class="row" style="justify-content: space-between;">
            <div class="muted">Job ID</div>
            <div class="mono">${props.jobId || status?.jobId || "n/a"}</div>
          </div>
          <div class="row" style="justify-content: space-between; margin-top: 8px;">
            <div class="muted">State</div>
            <div class="mono">${displayState || "n/a"}${progress !== null ? ` · ${progress}%` : ""}</div>
          </div>
          ${
            progress !== null
              ? html`<progress style="width: 100%; margin-top: 10px;" value=${String(progress)} max="100"></progress>`
              : nothing
          }
          ${
            pollingActive
              ? html`
                  <div class="muted" style="margin-top: 10px">
                    Auto-refresh actif (2.5s) tant que le job est en cours.
                  </div>
                `
              : nothing
          }
          ${
            clipperErr
              ? html`
                <div class="callout danger" style="margin-top: 12px;">
                  <div style="font-weight: 650;">${clipperErr.title}</div>
                  ${clipperErr.hint ? html`<div class="muted" style="margin-top: 6px;">${clipperErr.hint}</div>` : nothing}
                  <details style="margin-top: 10px;">
                    <summary class="muted" style="cursor: pointer;">Details techniques</summary>
                    <pre style="white-space: pre-wrap; margin-top: 10px;">${clipperErr.detail}</pre>
                    <div class="row" style="margin-top: 10px;">
                      <button
                        class="btn"
                        @click=${async () => {
                          try {
                            await navigator.clipboard.writeText(String(clipperErr.detail || ""));
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        Copy full error
                      </button>
                    </div>
                  </details>
                </div>
              `
              : nothing
          }
        </div>
        <div class="callout" style="margin-top: 12px">
          ${clips.length ? `${clips.length} clip(s) detecte(s).` : "Aucun clip pour l'instant (job en cours ou pas encore refresh)."}
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1" style="margin-top: 14px;">
      <div class="card">
        <div class="card-title">Clips</div>
        <div class="card-sub">Resultats finaux (preview + download).</div>

        ${
          clips.length
            ? html`${clips.slice(0, 12).map((c, i) => renderClip(c, i))}`
            : html`
                <div class="callout" style="margin-top: 12px">
                  <div style="font-weight: 600">Rien a afficher pour le moment</div>
                  <div class="muted" style="margin-top: 6px">
                    Si le job est <span class="mono">queued</span>/<span class="mono">running</span>, laisse
                    l'onglet ouvert: l'auto-refresh remontera les clips des qu'ils sont prets.
                  </div>
                </div>
              `
        }
      </div>
    </section>
  `;
}
