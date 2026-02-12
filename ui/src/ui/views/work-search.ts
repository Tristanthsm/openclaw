import { html, nothing } from "lit";
import type { SearchRouterResult, SearchRouterStatus } from "../controllers/work-search.ts";
import type { UiSettings } from "../storage.ts";
import { formatRelativeTimestamp } from "../format.ts";
import "./work-search-assistant.ts";

export type WorkSearchProps = {
  settings: UiSettings;
  loading: boolean;
  error: string | null;
  status: SearchRouterStatus | null;
  lastFetchAt: number | null;
  testQuery: string;
  testLoading: boolean;
  testError: string | null;
  testResponse: SearchRouterResult | null;
  onSettingsChange: (next: UiSettings) => void;
  onRefresh: () => void;
  onTestQueryChange: (next: string) => void;
  onRunTest: (queryOverride?: string) => void;
  onClearTest: () => void;
};

function normalizeQuota(used?: number, limit?: number, remaining?: number | null) {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return {
      used: 0,
      limit: null as number | null,
      remaining: null as number | null,
      pct: null as number | null,
    };
  }
  const safeUsed = typeof used === "number" && Number.isFinite(used) ? used : 0;
  const safeRemaining =
    typeof remaining === "number" && Number.isFinite(remaining)
      ? remaining
      : Math.max(0, limit - safeUsed);
  const pct = Math.min(100, Math.max(0, Math.round((safeUsed / limit) * 100)));
  return { used: safeUsed, limit, remaining: safeRemaining, pct };
}

function formatQuotaInline(used?: number, limit?: number, remaining?: number | null) {
  const q = normalizeQuota(used, limit, remaining);
  if (!q.limit) {
    return html`
      <span class="mono">n/a</span>
    `;
  }
  const tone =
    q.pct !== null && q.pct >= 95
      ? "#EF4444"
      : q.pct !== null && q.pct >= 80
        ? "#F59E0B"
        : "#10B981";
  return html`
    <span class="mono" style=${q.remaining === 0 ? "color:#EF4444" : ""}>${q.remaining}/${q.limit}</span>
    <span class="muted" style="margin-left:8px;">
      <span style=${`color:${tone};`}>${q.pct ?? 0}%</span>
    </span>
  `;
}

export function renderWorkSearch(props: WorkSearchProps) {
  const status = props.status;
  const braveDaily = status?.quotas?.brave?.daily;
  const braveMonthly = status?.quotas?.brave?.monthly;
  const tavilyDaily = status?.quotas?.tavily?.daily;
  const tavilyMonthly = status?.quotas?.tavily?.monthly;
  const resetsDay = status?.quotas?.resetsAt?.dayUtc ?? null;
  const resetsMonth = status?.quotas?.resetsAt?.monthUtc ?? null;
  const cooldown = status?.quotas?.cooldown ?? null;
  const dlq = status?.dlq ?? null;
  const stats = status?.stats ?? null;

  const showTestResults = Boolean(
    props.testResponse && props.testResponse.ok && props.testResponse.results?.length,
  );
  const testResults = props.testResponse?.results ?? [];
  const uiMode = props.settings.workSearchUiMode ?? "quick";

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: baseline;">
          <div>
            <div class="card-title">Search</div>
            <div class="card-sub">Lance une requête via le router n8n (sans exposer de clés).</div>
          </div>
          <div class="row" style="gap: 8px;">
            <button
              class="btn"
              @click=${() =>
                props.onSettingsChange({ ...props.settings, workSearchUiMode: "quick" })}
              ?disabled=${uiMode === "quick"}
              title="Mode rapide"
            >
              Quick
            </button>
            <button
              class="btn"
              @click=${() =>
                props.onSettingsChange({ ...props.settings, workSearchUiMode: "assistant" })}
              ?disabled=${uiMode === "assistant"}
              title="Assistant (questions -> requetes)"
            >
              Assistant
            </button>
          </div>
        </div>

        ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}

        ${
          uiMode === "assistant"
            ? html`
                <work-search-assistant
                  .settings=${props.settings}
                  .disabled=${props.testLoading}
                  @assistant-use-query=${(e: CustomEvent) => {
                    const q = String((e.detail as { query?: string })?.query ?? "");
                    if (q) {
                      props.onTestQueryChange(q);
                    }
                  }}
                  @assistant-run-query=${(e: CustomEvent) => {
                    const q = String((e.detail as { query?: string })?.query ?? "");
                    if (q) {
                      props.onRunTest(q);
                    }
                  }}
                  @assistant-apply-domains=${(e: CustomEvent) => {
                    const d = String((e.detail as { domains?: string })?.domains ?? "");
                    if (!d) {
                      return;
                    }
                    props.onSettingsChange({ ...props.settings, workSearchDomains: d });
                  }}
                ></work-search-assistant>
              `
            : html`
                <div class="row" style="margin-top: 10px; gap: 10px; align-items: flex-end;">
                  <label class="field" style="flex: 1;">
                    <span>Query</span>
                    <input
                      .value=${props.testQuery}
                      placeholder="site:reddit.com openclaw n8n"
                      @input=${(e: Event) =>
                        props.onTestQueryChange((e.target as HTMLInputElement).value)}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === "Enter" && !props.testLoading) {
                          props.onRunTest();
                        }
                      }}
                    />
                  </label>
                  <button class="btn" ?disabled=${props.testLoading} @click=${() => props.onRunTest()}>
                    ${props.testLoading ? "Running..." : "Run"}
                  </button>
                  <button class="btn" ?disabled=${props.testLoading} @click=${() => props.onClearTest()}>
                    Clear
                  </button>
                </div>

                <div class="row" style="margin-top: 10px; gap: 12px; align-items: center;">
                  <label class="row" style="gap: 10px; align-items: center; cursor: pointer;">
                    <input
                      type="checkbox"
                      .checked=${Boolean(props.settings.workSearchStrictFree)}
                      @change=${(e: Event) => {
                        const v = (e.target as HTMLInputElement).checked;
                        props.onSettingsChange({ ...props.settings, workSearchStrictFree: v });
                      }}
                    />
                    <span class="muted">Strict free tier</span>
                  </label>
                  <div style="flex: 1;"></div>
                  <button class="btn" ?disabled=${props.loading} @click=${() => props.onRefresh()}>
                    ${props.loading ? "Refreshing..." : "Refresh status"}
                  </button>
                  <div class="muted">
                    ${props.lastFetchAt ? html`${formatRelativeTimestamp(props.lastFetchAt)}` : nothing}
                  </div>
                </div>

        ${
          props.testError
            ? html`<div class="callout danger" style="margin-top: 12px;">${props.testError}</div>`
            : nothing
        }
        ${
          showTestResults
            ? html`
                <div class="callout" style="margin-top: 12px;">
                  <div class="muted">
                    Provider: <span class="mono">${props.testResponse?.providerUsed ?? "n/a"}</span>
                    ${props.testResponse?.resolvedQuery ? html` · Resolved: <span class="mono">${props.testResponse.resolvedQuery}</span>` : nothing}
                  </div>
                  <div style="margin-top: 10px;">
                    ${testResults.slice(0, 8).map((r) => {
                      const title = r.title || r.url || "Result";
                      return html`
                        <div style="margin-top: 10px;">
                          <a class="session-link" href=${r.url ?? ""} target="_blank" rel="noreferrer"
                            >${title}</a
                          >
                          ${r.snippet ? html`<div class="muted" style="margin-top: 4px;">${r.snippet}</div>` : nothing}
                        </div>
                      `;
                    })}
                  </div>
                </div>
              `
            : nothing
        }

        <details style="margin-top: 14px;">
          <summary class="muted" style="cursor: pointer;">Advanced</summary>
          <div class="form-grid" style="margin-top: 12px;">
            <label class="field">
              <span>Provider</span>
              <select
                .value=${props.settings.workSearchProvider}
                @change=${(e: Event) => {
                  const v = (e.target as HTMLSelectElement)
                    .value as UiSettings["workSearchProvider"];
                  props.onSettingsChange({
                    ...props.settings,
                    workSearchProvider: v === "brave" || v === "tavily" ? v : "auto",
                  });
                }}
              >
                <option value="auto">auto</option>
                <option value="brave">brave</option>
                <option value="tavily">tavily</option>
              </select>
            </label>
            <label class="field">
              <span>Mode</span>
              <select
                .value=${props.settings.workSearchMode}
                @change=${(e: Event) => {
                  const v = (e.target as HTMLSelectElement).value;
                  props.onSettingsChange({
                    ...props.settings,
                    workSearchMode: v === "deep" ? "deep" : "serp",
                  });
                }}
              >
                <option value="serp">serp</option>
                <option value="deep">deep</option>
              </select>
            </label>
            <label class="field">
              <span>Max results</span>
              <input
                type="number"
                min="1"
                max="20"
                .value=${String(props.settings.workSearchMaxResults)}
                @input=${(e: Event) => {
                  const raw = (e.target as HTMLInputElement).value;
                  const n = Math.min(20, Math.max(1, Math.floor(Number(raw || 10))));
                  props.onSettingsChange({ ...props.settings, workSearchMaxResults: n });
                }}
              />
            </label>
            <label class="field">
              <span>Domain allowlist</span>
              <input
                .value=${props.settings.workSearchDomains}
                placeholder="reddit.com, github.com"
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  props.onSettingsChange({ ...props.settings, workSearchDomains: v });
                }}
              />
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
                .value=${props.settings.workSearchRouterWebhookPath}
                placeholder="/webhook/cmd-search-router"
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  props.onSettingsChange({ ...props.settings, workSearchRouterWebhookPath: v });
                }}
              />
            </label>
          </div>
        </details>
              `
        }
      </div>

      <div class="card">
        <div class="card-title">Quotas</div>
        <div class="card-sub">Status live du router (op=status). Aucun crédit provider consommé.</div>

        <div class="stat-grid" style="margin-top: 16px; grid-template-columns: repeat(2, minmax(0, 1fr));">
          <div class="stat">
            <div class="stat-label">Brave</div>
            <div class="stat-value" style="font-size: 14px; line-height: 1.35;">
              <div class="row" style="justify-content: space-between;">
                <span class="muted">Today</span>
                <span>${formatQuotaInline(braveDaily?.used, braveDaily?.limit, braveDaily?.remaining)}</span>
              </div>
              <div class="row" style="justify-content: space-between; margin-top: 6px;">
                <span class="muted">Month</span>
                <span>${formatQuotaInline(braveMonthly?.used, braveMonthly?.limit, braveMonthly?.remaining)}</span>
              </div>
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Tavily</div>
            <div class="stat-value" style="font-size: 14px; line-height: 1.35;">
              <div class="row" style="justify-content: space-between;">
                <span class="muted">Today</span>
                <span>${formatQuotaInline(tavilyDaily?.used, tavilyDaily?.limit, tavilyDaily?.remaining)}</span>
              </div>
              <div class="row" style="justify-content: space-between; margin-top: 6px;">
                <span class="muted">Month</span>
                <span>${formatQuotaInline(tavilyMonthly?.used, tavilyMonthly?.limit, tavilyMonthly?.remaining)}</span>
              </div>
            </div>
          </div>
        </div>

        ${
          props.settings.workSearchStrictFree &&
          tavilyDaily?.limit &&
          normalizeQuota(tavilyDaily.used, tavilyDaily.limit, tavilyDaily.remaining).remaining === 0
            ? html`<div class="callout danger" style="margin-top: 12px;">
                Tavily: cap journalier atteint. Reset (UTC): ${resetsDay ? resetsDay.slice(0, 10) : "n/a"}.
              </div>`
            : nothing
        }

        <div class="callout" style="margin-top: 14px;">
          <div class="row" style="justify-content: space-between;">
            <div>Resets (UTC)</div>
            <div class="mono">
              ${resetsDay ? resetsDay.slice(0, 10) : "n/a"} · ${resetsMonth ? resetsMonth.slice(0, 10) : "n/a"}
            </div>
          </div>
          ${
            cooldown?.brave || cooldown?.tavily
              ? html`
                  <div class="row" style="justify-content: space-between; margin-top: 8px;">
                    <div class="muted">Cooldown</div>
                    <div class="mono">
                      ${cooldown?.brave ? "brave" : ""}${cooldown?.brave && cooldown?.tavily ? " + " : ""}${cooldown?.tavily ? "tavily" : ""}
                    </div>
                  </div>
                `
              : nothing
          }
          ${stats ? html`<div class="muted" style="margin-top: 8px;">Exec: <span class="mono">${stats.executions ?? 0}</span> · Cache: <span class="mono">${stats.cacheHits ?? 0}</span> · Errors: <span class="mono">${stats.httpErrors ?? 0}</span></div>` : nothing}
        </div>

        <details style="margin-top: 14px;">
          <summary class="muted" style="cursor: pointer;">
            Debug ${dlq?.size ? html`<span class="mono">(DLQ: ${dlq.size})</span>` : nothing}
          </summary>
          ${
            dlq?.tail && Array.isArray(dlq.tail) && dlq.tail.length
              ? html`
                  <div class="callout danger" style="margin-top: 12px;">
                    <div class="muted">DLQ size: <span class="mono">${dlq.size ?? dlq.tail.length}</span></div>
                    <div class="muted" style="margin-top: 6px;">
                      Les items peuvent être anciens (avant fixes). Affiché: 5 derniers.
                    </div>
                    ${dlq.tail
                      .slice(-5)
                      .toReversed()
                      .map((entry) => {
                        const raw = entry as Record<string, unknown>;
                        const ts = String(raw.ts ?? "");
                        const provider = String(raw.providerUsed ?? "");
                        const message = String(raw.message ?? "");
                        const query = String(raw.query ?? "");
                        return html`
                          <div style="margin-top: 10px;">
                            <div class="mono">${ts}${provider ? ` · ${provider}` : ""}</div>
                            ${query ? html`<div class="muted">Q: ${query}</div>` : nothing}
                            ${message ? html`<div class="muted">${message}</div>` : nothing}
                          </div>
                        `;
                      })}
                  </div>
                `
              : html`
                  <div class="callout" style="margin-top: 12px">DLQ vide.</div>
                `
          }
          ${
            status?.limits
              ? html`
                  <div class="callout" style="margin-top: 12px;">
                    <div class="muted">
                      Cache TTL: <span class="mono">${Math.round((status.limits.cacheTtlMs ?? 0) / 60000)}m</span>
                      · Provider cooldown:
                      <span class="mono">${Math.round((status.limits.providerCooldownMs ?? 0) / 1000)}s</span>
                    </div>
                  </div>
                `
              : nothing
          }
        </details>
      </div>
    </section>
  `;
}
