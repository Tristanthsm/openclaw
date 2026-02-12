import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { UiSettings } from "../storage.ts";

type Role = "bot" | "user";
type Msg = { role: Role; text: string };

type Draft = {
  project: string;
  goal: string;
  target: string;
  keywords: string;
  geo: string;
  sources: string;
};

const QUESTIONS: Array<{ key: keyof Draft; label: string; placeholder: string }> = [
  {
    key: "project",
    label: "Nom du projet (optionnel)",
    placeholder: "Ex: BeFood - Prospection coachs",
  },
  { key: "goal", label: "Objectif", placeholder: "Ex: trouver des profils a contacter" },
  {
    key: "target",
    label: "Cible (qui veux-tu trouver?)",
    placeholder: "Ex: nutritionniste, coach, dev, founder...",
  },
  {
    key: "keywords",
    label: "Mots-cles / secteur",
    placeholder: "Ex: nutrition IA, tracking photo, coaching",
  },
  { key: "geo", label: "Zone / langue", placeholder: "Ex: France, francophone, EU..." },
  {
    key: "sources",
    label: "Sources (domaines, optionnel)",
    placeholder: "Ex: reddit.com, github.com",
  },
];

function normalizeCsv(value: string) {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
    .join(", ");
}

function compact(text: string) {
  return (text || "").trim().replace(/\s+/g, " ").slice(0, 240);
}

function buildQueries(draft: Draft, fallbackDomains: string) {
  const target = compact(draft.target);
  const kw = compact(draft.keywords);
  const geo = compact(draft.geo);
  const domains = normalizeCsv(draft.sources || fallbackDomains);

  const base = [target, kw, geo].filter(Boolean).join(" ").trim();
  const withDomain = (d: string) =>
    base ? `site:${d} ${base}` : `site:${d} ${target || kw || geo}`.trim();

  const suggested = [
    withDomain("reddit.com"),
    withDomain("github.com"),
    base ? `${base} contact` : "",
  ].filter(Boolean);

  return { domains, suggested };
}

@customElement("work-search-assistant")
export class WorkSearchAssistant extends LitElement {
  @property({ attribute: false }) settings!: UiSettings;
  @property({ type: Boolean }) disabled = false;

  @state() step = 0;
  @state() messages: Msg[] = [];
  @state() input = "";
  @state() done = false;
  @state() draft: Draft = {
    project: "",
    goal: "",
    target: "",
    keywords: "",
    geo: "",
    sources: "",
  };
  @state() suggestedQueries: string[] = [];
  @state() suggestedDomains = "";

  createRenderRoot() {
    // Use the app's global styles.
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.messages.length) {
      this.reset();
    }
  }

  reset() {
    this.step = 0;
    this.done = false;
    this.draft = { project: "", goal: "", target: "", keywords: "", geo: "", sources: "" };
    this.suggestedQueries = [];
    this.suggestedDomains = "";
    this.messages = [
      {
        role: "bot",
        text: `Je vais t'aider a preparer une recherche efficace (0€ / quotas). ${QUESTIONS[0].label}:`,
      },
    ];
    this.input = "";
  }

  private push(role: Role, text: string) {
    this.messages = [...this.messages, { role, text }];
  }

  private setDraftValue(key: keyof Draft, value: string) {
    this.draft = { ...this.draft, [key]: value };
  }

  private finalize() {
    const { domains, suggested } = buildQueries(
      this.draft,
      this.settings?.workSearchDomains || "reddit.com, github.com",
    );
    this.suggestedQueries = suggested.slice(0, 5);
    this.suggestedDomains = domains;
    this.done = true;
    this.push(
      "bot",
      "OK. Je te propose des requetes. Tu peux en lancer une, ou juste copier/coller.",
    );
  }

  submit() {
    if (this.disabled) {
      return;
    }
    const text = (this.input || "").trim();
    if (!text) {
      return;
    }

    const current = QUESTIONS[this.step];
    if (!current) {
      return;
    }

    this.push("user", text);
    this.setDraftValue(current.key, text);
    this.input = "";

    const nextStep = this.step + 1;
    if (nextStep >= QUESTIONS.length) {
      this.step = QUESTIONS.length;
      this.finalize();
      return;
    }

    this.step = nextStep;
    const q = QUESTIONS[nextStep];
    this.push("bot", `${q.label}:`);
  }

  private dispatchUseQuery(query: string) {
    this.dispatchEvent(
      new CustomEvent("assistant-use-query", { detail: { query }, bubbles: true, composed: true }),
    );
  }

  private dispatchRunQuery(query: string) {
    this.dispatchEvent(
      new CustomEvent("assistant-run-query", { detail: { query }, bubbles: true, composed: true }),
    );
  }

  private dispatchApplyDomains(domains: string) {
    this.dispatchEvent(
      new CustomEvent("assistant-apply-domains", {
        detail: { domains },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const prompt = QUESTIONS[Math.min(this.step, QUESTIONS.length - 1)];
    const showSuggestions = this.done && this.suggestedQueries.length;

    return html`
      <div class="callout" style="margin-top: 12px;">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <div class="muted">Assistant (beta)</div>
          <div class="row" style="gap: 10px;">
            <button class="btn" ?disabled=${this.disabled} @click=${() => this.reset()}>Reset</button>
          </div>
        </div>

        <div style="margin-top: 10px; max-height: 220px; overflow: auto; padding-right: 4px;">
          ${this.messages.map((m) => {
            const bg = m.role === "bot" ? "rgba(255,255,255,0.03)" : "rgba(16,185,129,0.10)";
            const border = m.role === "bot" ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.22)";
            const label = m.role === "bot" ? "Assistant" : "You";
            return html`
              <div style=${`margin-top:10px; border:1px solid ${border}; background:${bg}; border-radius:12px; padding:10px;`}>
                <div class="muted" style="font-size: 12px;">${label}</div>
                <div style="margin-top: 4px;">${m.text}</div>
              </div>
            `;
          })}
        </div>

        ${
          showSuggestions
            ? html`
              <div style="margin-top: 12px;">
                <div class="muted">Domain allowlist suggeree</div>
                <div class="row" style="justify-content: space-between; gap: 10px; margin-top: 6px;">
                  <span class="mono" style="overflow:hidden; text-overflow:ellipsis;">${this.suggestedDomains || "n/a"}</span>
                  <button
                    class="btn"
                    ?disabled=${this.disabled || !this.suggestedDomains}
                    @click=${() => this.dispatchApplyDomains(this.suggestedDomains)}
                  >
                    Apply
                  </button>
                </div>
              </div>
              <div style="margin-top: 12px;">
                <div class="muted">Requetes suggerees (1 clic)</div>
                ${this.suggestedQueries.map(
                  (q) => html`
                    <div class="row" style="justify-content: space-between; gap: 10px; margin-top: 10px; align-items: flex-start;">
                      <div class="mono" style="flex:1; white-space: normal; overflow-wrap:anywhere;">${q}</div>
                      <div class="row" style="gap: 8px;">
                        <button class="btn" ?disabled=${this.disabled} @click=${() => this.dispatchUseQuery(q)}>Use</button>
                        <button class="btn" ?disabled=${this.disabled} @click=${() => this.dispatchRunQuery(q)}>Run</button>
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
            : nothing
        }

        ${
          !this.done
            ? html`
              <div class="row" style="margin-top: 12px; gap: 10px; align-items: flex-end;">
                <label class="field" style="flex: 1;">
                  <span>${prompt?.label ?? "Reponse"}</span>
                  <input
                    .value=${this.input}
                    placeholder=${prompt?.placeholder ?? ""}
                    ?disabled=${this.disabled}
                    @input=${(e: Event) => (this.input = (e.target as HTMLInputElement).value)}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === "Enter") {
                        this.submit();
                      }
                    }}
                  />
                </label>
                <button class="btn" ?disabled=${this.disabled} @click=${() => this.submit()}>Send</button>
              </div>
              <div class="muted" style="margin-top: 10px;">
                Astuce: reste simple. Tu pourras filtrer ensuite avec les resultats.
              </div>
            `
            : html`
                <div class="muted" style="margin-top: 12px">
                  Tu peux maintenant lancer une requete, ou repasser en mode Quick pour ajuster provider/mode.
                </div>
              `
        }
      </div>
    `;
  }
}
