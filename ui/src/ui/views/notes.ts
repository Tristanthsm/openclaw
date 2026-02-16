import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import type { ChatProps } from "./chat.ts";
import { parseAgentSessionKey } from "../../../../src/sessions/session-key-utils.js";
import { refreshChatAvatar } from "../app-chat.ts";
import { loadChatHistory } from "../controllers/chat.ts";
import { renderChat } from "./chat.ts";

// Helper type to avoid using 'any' for OpenClawApp methods not in AppViewState
type AppMethods = {
  resetToolStream: () => void;
  resetChatScroll: () => void;
  loadAssistantIdentity: () => Promise<void>;
  handleChatScroll: (event: Event) => void;
  handleSendChat: (msg?: string, opts?: { restoreDraft?: boolean }) => Promise<void>;
  handleAbortChat: () => Promise<void>;
  removeQueuedMessage: (id: string) => void;
  chatManualRefreshInFlight: boolean;
  scrollToBottom: (opts?: { smooth?: boolean }) => void;
  chatStreamStartedAt: number | null;
};

export function renderNotes(state: AppViewState) {
  const app = state as unknown as AppMethods;

  const isChat = false;
  const chatFocus = false;
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;
  const chatDisabledReason = state.connected ? null : "Disconnected from gateway.";

  // Resolve assistant identity
  const list = state.agentsList?.agents ?? [];
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId = parsed?.agentId ?? state.agentsList?.defaultId ?? "main";
  const agent = list.find((entry) => entry.id === agentId);
  const identity = agent?.identity;

  const assistantName = identity?.name ?? "Assistant";

  // Resolve avatar URL with fallback logic similar to app-render.ts
  const AVATAR_DATA_RE = /^data:/i;
  const AVATAR_HTTP_RE = /^https?:\/\//i;
  const candidate = identity?.avatarUrl ?? identity?.avatar;
  let assistantAvatarUrl: string | undefined = undefined;
  if (candidate) {
    if (AVATAR_DATA_RE.test(candidate) || AVATAR_HTTP_RE.test(candidate)) {
      assistantAvatarUrl = candidate;
    } else {
      assistantAvatarUrl = identity?.avatarUrl;
    }
  }
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;

  const chatProps: ChatProps = {
    sessionKey: state.sessionKey,
    onSessionKeyChange: (next) => {
      state.sessionKey = next;
      state.chatMessage = "";
      state.chatAttachments = [];
      state.chatStream = null;
      app.chatStreamStartedAt = null;
      state.chatRunId = null;
      state.chatQueue = [];
      app.resetToolStream();
      app.resetChatScroll();
      state.applySettings({
        ...state.settings,
        sessionKey: next,
        lastActiveSessionKey: next,
      });
      void app.loadAssistantIdentity();
      void loadChatHistory(state as any);
      void refreshChatAvatar(state as any);
    },
    thinkingLevel: state.chatThinkingLevel,
    showThinking,
    loading: state.chatLoading,
    sending: state.chatSending,
    compactionStatus: state.compactionStatus,
    assistantAvatarUrl: chatAvatarUrl,
    messages: state.chatMessages,
    toolMessages: state.chatToolMessages,
    stream: state.chatStream,
    streamStartedAt: app.chatStreamStartedAt,
    draft: state.chatMessage,
    queue: state.chatQueue,
    connected: state.connected,
    canSend: state.connected,
    disabledReason: chatDisabledReason,
    error: state.lastError,
    sessions: state.sessionsResult,
    focusMode: chatFocus,
    onRefresh: () => {
      app.resetToolStream();
      return Promise.all([loadChatHistory(state as any), refreshChatAvatar(state as any)]).then(
        () => {},
      );
    },
    onToggleFocusMode: () => {
      // No-op in notes view
    },
    onChatScroll: (event) => app.handleChatScroll(event),
    onDraftChange: (next) => (state.chatMessage = next),
    attachments: state.chatAttachments,
    onAttachmentsChange: (next) => (state.chatAttachments = next),
    onSend: () => {
      const notes = state.notesContent.trim();
      const draft = state.chatMessage.trim();

      if (!draft && !state.chatAttachments.length) {
        return;
      }

      let message = draft;
      if (notes) {
        // Inject notes context invisibly or visibly?
        // Visibly is safer for the user to know what's sent.
        // We'll append it to the message sent to the backend, but we might want to keep the UI draft clean?
        // handleSendChat takes an override.
        message = `${draft}\n\n<context>\nUser notes content:\n${notes}\n</context>`;
      }

      // We manually clear draft so it doesn't look like we sent the huge context text in the input box,
      // but the user sees the message in the history.
      // Actually handleSendChat(message) will display 'message' in the bubble.
      // If we want hidden context, we'd need protocol support.
      // For now, let's just send it. The user will see the context.
      // Alternatively, we can use a system prompt if we had access, but we don't.

      app.handleSendChat(message);
    },
    canAbort: Boolean(state.chatRunId),
    onAbort: () => void app.handleAbortChat(),
    onQueueRemove: (id) => app.removeQueuedMessage(id),
    onNewSession: () => app.handleSendChat("/new", { restoreDraft: true }),
    showNewMessages: state.chatNewMessagesBelow && !app.chatManualRefreshInFlight,
    onScrollToBottom: () => app.scrollToBottom(),
    sidebarOpen: state.sidebarOpen,
    sidebarContent: state.sidebarContent,
    sidebarError: state.sidebarError,
    splitRatio: state.splitRatio,
    onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
    onCloseSidebar: () => state.handleCloseSidebar(),
    onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
    assistantName,
    assistantAvatar: null,
  };

  // Inline styles for the notes view to avoid creating a new CSS file immediately
  // These variables are inferred from the existing CSS structure
  return html`
    <style>
      .notes-container {
        display: flex;
        height: 100%;
        overflow: hidden;
        flex-direction: row;
      }
      .notes-editor-pane {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 1.5rem;
        border-right: 1px solid var(--border-subtle, #eee);
        min-width: 300px;
        background: var(--bg-surface-base, #fff);
      }
      .notes-chat-pane {
        flex: 1.2;
        min-width: 400px;
        display: flex;
        flex-direction: column;
        background: var(--bg-surface-elevated, #f9f9f9);
      }
      .notes-title {
        margin: 0 0 1rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-heading, #111);
      }
      .notes-textarea {
        flex: 1;
        width: 100%;
        resize: none;
        background: var(--bg-field, #fff);
        color: var(--text-body, #333);
        border: 1px solid var(--border-field, #ccc);
        border-radius: 8px;
        padding: 1.25rem;
        font-family: var(--font-mono, monospace);
        font-size: 14px;
        line-height: 1.6;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .notes-textarea:focus {
        border-color: var(--color-primary, #007bff);
        box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(0,123,255,0.1));
      }
      @media (max-width: 768px) {
        .notes-container {
          flex-direction: column;
        }
        .notes-editor-pane {
          border-right: none;
          border-bottom: 1px solid var(--border-subtle, #eee);
          height: 40%;
          min-height: 200px;
        }
        .notes-chat-pane {
          height: 60%;
        }
      }
    </style>
    <div class="notes-container">
      <div class="notes-editor-pane">
        <h3 class="notes-title">My Notes</h3>
        <textarea
            class="notes-textarea"
            .value=${state.notesContent}
            @input=${(e: Event) => state.setNotesContent((e.target as HTMLTextAreaElement).value)}
            placeholder="Capture your thoughts, drafts, and ideas here...

Tip: You can ask the AI assistant on the right to read, summarize, or refine these notes."
        ></textarea>
      </div>
      <div class="notes-chat-pane">
         ${renderChat(chatProps)}
      </div>
    </div>
  `;
}
