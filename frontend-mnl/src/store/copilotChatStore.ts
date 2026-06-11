import { create } from "zustand";

export type CopilotChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "chat" | "tool-call";
  status?: "running" | "completed";
  toolName?: string;
};

interface CopilotChatState {
  messages: CopilotChatMessage[];
  appendMessage: (message: Omit<CopilotChatMessage, "id">) => string;
  updateMessage: (id: string, patch: Partial<CopilotChatMessage>) => void;
  clearMessages: () => void;
}

const DEFAULT_ASSISTANT_MESSAGE: CopilotChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "Welcome to Scientific Copilot. I can switch views for molecular analysis, similarity, experiment planning, and risk review.",
  kind: "chat",
};

export const useCopilotChatStore = create<CopilotChatState>((set) => ({
  messages: [DEFAULT_ASSISTANT_MESSAGE],
  appendMessage: (message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      messages: [...state.messages, { ...message, id, kind: message.kind ?? "chat" }],
    }));
    return id;
  },
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((message) => (message.id === id ? { ...message, ...patch } : message)),
    })),
  clearMessages: () => set({ messages: [DEFAULT_ASSISTANT_MESSAGE] }),
}));
