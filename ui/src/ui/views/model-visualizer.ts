import { html, nothing } from "lit";

export type ModelVisualizerProps = {
  loading: boolean;
  error: string | null;
  query: string;
  modelName: string;
  onQueryChange: (next: string) => void;
  onModelChange: (next: string) => void;
  onAnalyze: () => void;
  analysisResult: ModelAnalysisResult | null;
};

export type ModelAnalysisResult = {
  ok: boolean;
  source: "real" | "simulated";
  model: string;
  layers: number;
  heads: number;
  activations: number[][]; // [layer][head]
};

const AVAILABLE_MODELS = [
  { id: "gpt2", label: "GPT-2 (117M)" },
  { id: "gpt2-medium", label: "GPT-2 Medium (345M)" },
  { id: "distilgpt2", label: "DistilGPT-2 (82M)" },
];

export function renderModelVisualizer(props: ModelVisualizerProps) {
  const result = props.analysisResult;
  const isReal = result?.source === "real";

  return html`
    <section class="grid grid-cols-1">
      <div class="card">
        <div class="card-title">AI Model Visualizer</div>
        <div class="card-sub">Activations réelles des têtes d'attention, couche par couche.</div>

        <div class="row" style="margin-top: 16px; gap: 10px; flex-wrap: wrap; align-items: flex-end;">
          <label class="field" style="min-width: 160px;">
            <span>Modèle</span>
            <select
              .value=${props.modelName}
              @change=${(e: Event) => props.onModelChange((e.target as HTMLSelectElement).value)}
            >
              ${AVAILABLE_MODELS.map(
                (m) => html`
                <option value=${m.id} ?selected=${props.modelName === m.id}>${m.label}</option>
              `,
              )}
            </select>
          </label>

          <label class="field" style="flex: 1; min-width: 200px;">
            <span>Input Query</span>
            <input
              .value=${props.query}
              placeholder="Entrez une phrase pour voir comment le modèle réagit..."
              @input=${(e: Event) => props.onQueryChange((e.target as HTMLInputElement).value)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" && !props.loading) {
                  props.onAnalyze();
                }
              }}
            />
          </label>

          <button class="btn" ?disabled=${props.loading} @click=${() => props.onAnalyze()}>
            ${props.loading ? "Analyse..." : "Analyser"}
          </button>
        </div>

        ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}
      </div>

      ${
        result
          ? html`
        <div class="card" style="margin-top: 16px;">
          <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <div class="card-title">Carte d'Activations</div>
              <div class="card-sub">${result.layers} couches × ${result.heads} têtes</div>
            </div>
            <div class="pill ${isReal ? "ok" : ""}" style="font-size: 11px;">
              ${isReal ? `🧠 Réel – ${result.model}` : "⚡ Simulation"}
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <!-- Y-axis label -->
            <div style="display: flex; align-items: center; padding-bottom: 16px;">
              <span class="muted" style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; letter-spacing: 1px;">COUCHES</span>
            </div>

            <div style="flex: 1; overflow-x: auto;">
              <div style="display: grid; grid-template-columns: repeat(${result.heads}, 1fr); gap: 3px; min-width: ${result.heads * 28}px;">
                ${result.activations.map((layerActivations, layerIdx) =>
                  layerActivations.map((activation, headIdx) => {
                    const intensity = Math.round(activation * 255);
                    const bg = `rgb(${intensity}, ${Math.floor(intensity * 0.5)}, ${Math.floor(255 - intensity * 0.9)})`;
                    return html`
                      <div
                        class="activation-cell"
                        style="height: 24px; background: ${bg}; border-radius: 3px; cursor: pointer;"
                        title="Layer ${layerIdx + 1} / Head ${headIdx + 1} — activation: ${activation.toFixed(3)}"
                      ></div>
                    `;
                  }),
                )}
              </div>
              <!-- X-axis label -->
              <div class="muted" style="text-align: center; font-size: 10px; letter-spacing: 1px; margin-top: 6px;">TÊTES D'ATTENTION</div>
            </div>
          </div>

          <!-- Colour scale legend -->
          <div class="row" style="margin-top: 16px; align-items: center; gap: 12px; justify-content: center;">
            <span class="muted" style="font-size: 11px;">Inactif</span>
            <div style="width: 120px; height: 10px; border-radius: 5px; background: linear-gradient(to right, rgb(0,0,255), rgb(255,127,0)); opacity: 0.8;"></div>
            <span class="muted" style="font-size: 11px;">Très actif</span>
          </div>
        </div>
      `
          : nothing
      }
    </section>

    <style>
      .activation-cell {
        transition: transform 0.1s ease, box-shadow 0.1s ease;
        position: relative;
      }
      .activation-cell:hover {
        transform: scale(1.4);
        box-shadow: 0 0 8px rgba(255,200,100,0.7);
        z-index: 20;
      }
    </style>
  `;
}
