export interface VaultItem {
  id: string;
  title: string;
  description: string;
  category: string;
  fileType: string;
  subjects: string[];
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  updatedAt: string;
}
export interface VaultData {
  files: VaultItem[];
  usedBytes: number;
  maxBytes: number;
  maxUploadBytes: number;
}
export interface ChatActionView {
  id: string;
  type: string;
  payload: {
    title?: string;
    content?: string;
    category?: string;
    fileId?: string;
    changes?: Record<string, unknown>;
  };
  appliedAt: string | null;
  resultId: string | null;
}
export interface ChatMessageView {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  actions: ChatActionView[];
}
export interface ChatThreadView {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}
export interface ChatDetail {
  id: string;
  title: string;
  busyUntil: string | null;
  messages: ChatMessageView[];
}
export interface AiConfig {
  configured: boolean;
  model: string;
}
