export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AiConversation = {
  id: string;
  title: string;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
};

const KEY = "pan_ai_conversations";

function readAll(): AiConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(KEY);
    return value ? (JSON.parse(value) as AiConversation[]) : [];
  } catch {
    return [];
  }
}
function writeAll(list: AiConversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore storage failures
  }
}
function now() {
  return new Date().toISOString();
}

export function getConversations(): AiConversation[] {
  return readAll().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
export function getConversation(id: string): AiConversation | null {
  return readAll().find((c) => c.id === id) ?? null;
}

export function createConversation(): AiConversation {
  const conv: AiConversation = { id: `chat_${Date.now()}`, title: "New chat", messages: [], createdAt: now(), updatedAt: now() };
  writeAll([conv, ...readAll()]);
  return conv;
}

export function addMessage(conversationId: string, role: AiMessage["role"], content: string): AiConversation | null {
  const conv = getConversation(conversationId);
  if (!conv) return null;
  const msg: AiMessage = { id: `msg_${Date.now()}`, role, content, createdAt: now() };
  const messages = [...conv.messages, msg];
  const title = conv.title === "New chat" && role === "user" ? content.slice(0, 60) : conv.title;
  const updated: AiConversation = { ...conv, messages, title, updatedAt: now() };
  writeAll(readAll().map((c) => (c.id === conversationId ? updated : c)));
  return updated;
}

export function deleteConversation(id: string) {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function clearConversations() {
  writeAll([]);
}