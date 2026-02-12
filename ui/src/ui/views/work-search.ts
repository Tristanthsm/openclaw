import { html, nothing } from "lit";
import type { SearchRouterResult, SearchRouterStatus } from "../controllers/work-search.ts";
import type { UiSettings } from "../storage.ts";
import { formatRelativeTimestamp } from "../format.ts";

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

function formatQuotaCell(used?: number, limit?: number, remaining?: number | null) {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return html`
      <span class="mono">n/a</span>
    `;
  }
  const safeUsed = typeof used === "number" && Number.isFinite(used) ? used : 0;
  const safeRemaining =
    typeof remaining === "number" && Number.isFinite(remaining)
      ? remaining
      : Math.max(0, limit - safeUsed);
  const pct = Math.min(100, Math.max(0, Math.round((safeUsed / limit) * 100)));
  return html`
    <div>
      <div class="row" style="justify-content: space-between; gap: 10px;">
        <span class="mono">${safeUsed}/${limit}</span>
        <span class="muted">${pct}%</span>
      </div>
      <div class="row" style="justify-content: space-between; gap: 10px; margin-top: 6px;">
        <span class="muted">Remaining</span>
        <span class="mono">${safeRemaining}</span>
      </div>
      <div
        style="height: 8px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden; margin-top: 8px;"
        aria-label="quota progress"
      >
        <div
          style=${`height: 100%; width: ${pct}%; background: ${pct >= 95 ? "#EF4444" : pct >= 80 ? "#F59E0B" : "#10B981"};`}
        ></div>
      </div>
    </div>
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

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Search Router</div>
        <div class="card-sub">Configure your n8n router endpoint and run test queries.</div>

        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>n8n Base Path</span>
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
            <span>Webhook Path</span>
            <input
              .value=${props.settings.workSearchRouterWebhookPath}
              placeholder="/webhook/cmd-search-router"
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, workSearchRouterWebhookPath: v });
              }}
            />
          </label>
          <label class="field">
            <span>Provider</span>
            <select
              .value=${props.settings.workSearchProvider}
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value as UiSettings["workSearchProvider"];
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
            <span>Max Results</span>
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
            <span>Strict Free Tier</span>
            <select
              .value=${props.settings.workSearchStrictFree ? "true" : "false"}
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value === "true";
                props.onSettingsChange({ ...props.settings, workSearchStrictFree: v });
              }}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>

        <label class="field" style="margin-top: 12px;">
          <span>Domain Allowlist (comma-separated)</span>
          <input
            .value=${props.settings.workSearchDomains}
            placeholder="reddit.com, github.com"
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onSettingsChange({ ...props.settings, workSearchDomains: v });
            }}
          />
        </label>

        <div class="row" style="margin-top: 14px;">
          <button class="btn" ?disabled=${props.loading} @click=${() => props.onRefresh()}>
            ${props.loading ? "Refreshing..." : "Refresh Status"}
          </button>
          <div class="muted">
            ${props.lastFetchAt ? html`Last: ${formatRelativeTimestamp(props.lastFetchAt)}` : nothing}
          </div>
        </div>

        ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}

        <div class="card-title" style="margin-top: 18px;">Test Query</div>
        <div class="row" style="margin-top: 10px; gap: 10px; align-items: flex-end;">
          <label class="field" style="flex: 1;">
            <span>Query</span>
            <input
              .value=${props.testQuery}
              placeholder="site:reddit.com openclaw n8n"
              @input=${(e: Event) => props.onTestQueryChange((e.target as HTMLInputElement).value)}
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
      </div>

      <div class="card">
        <div class="card-title">Quotas</div>
        <div class="card-sub">Live limits and reset windows from the router (op=status).</div>

        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Brave Daily</div>
            <div class="stat-value">${formatQuotaCell(braveDaily?.used, braveDaily?.limit, braveDaily?.remaining)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Brave Monthly</div>
            <div class="stat-value">${formatQuotaCell(braveMonthly?.used, braveMonthly?.limit, braveMonthly?.remaining)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Tavily Daily</div>
            <div class="stat-value">${formatQuotaCell(tavilyDaily?.used, tavilyDaily?.limit, tavilyDaily?.remaining)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Tavily Monthly</div>
            <div class="stat-value">${formatQuotaCell(tavilyMonthly?.used, tavilyMonthly?.limit, tavilyMonthly?.remaining)}</div>
          </div>
        </div>

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
          ${
            stats
              ? html`
                  <div class="row" style="justify-content: space-between; margin-top: 8px;">
                    <div class="muted">Executions</div>
                    <div class="mono">${stats.executions ?? 0}</div>
                  </div>
                  <div class="row" style="justify-content: space-between;">
                    <div class="muted">Cache Hits</div>
                    <div class="mono">${stats.cacheHits ?? 0}</div>
                  </div>
                  <div class="row" style="justify-content: space-between;">
                    <div class="muted">Provider Calls</div>
                    <div class="mono">${stats.providerCalls ?? 0}</div>
                  </div>
                  <div class="row" style="justify-content: space-between;">
                    <div class="muted">HTTP Errors</div>
                    <div class="mono">${stats.httpErrors ?? 0}</div>
                  </div>
                  <div class="row" style="justify-content: space-between;">
                    <div class="muted">Auth Errors</div>
                    <div class="mono">${stats.authErrors ?? 0}</div>
                  </div>
                `
              : nothing
          }
        </div>

        <div class="card-title" style="margin-top: 18px;">DLQ (recent failures)</div>
        <div class="card-sub">Last 10 failures kept by the router. Useful when adding new providers.</div>
        ${
          dlq?.tail && Array.isArray(dlq.tail) && dlq.tail.length
            ? html`
                <div class="callout danger" style="margin-top: 12px;">
                  <div class="muted">DLQ size: <span class="mono">${dlq.size ?? dlq.tail.length}</span></div>
                  <div class="muted" style="margin-top: 6px;">
                    Most recent entries are shown first (older items may be from before fixes).
                  </div>
                  ${dlq.tail
                    .slice(-10)
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
                <div class="callout" style="margin-top: 12px">No recent failures.</div>
              `
        }
      </div>
    </section>
  `;
}
