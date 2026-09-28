export type DocumentRole = 'target' | 'reference';

export type EmbeddingStatus = 'idle' | 'queued' | 'embedding' | 'ready' | 'error';

export interface TargetDocumentItem {
  id: string;
  file?: File;
  /** Session draft text for /cloud/run — never uploaded as a note. */
  text?: string;
  name: string;
  size: string;
  role: 'target';
  wordCount?: number;
  characterCount?: number;
  uploadedAt: Date;
  status: 'ready' | 'loading' | 'error';
}

export interface ReferenceDocumentItem {
  id: string;
  file?: File;
  name: string;
  size: string;
  role: 'reference';
  uploadedAt: Date;
  embeddingStatus: EmbeddingStatus;
  embeddingProgress: number; // 0 to 100
  chunks: number;
  isStale?: boolean;
  error?: string;
}

export type UploadedFileItem =
  | ReferenceDocumentItem
  | (TargetDocumentItem & {
      embeddingStatus?: EmbeddingStatus;
      embeddingProgress?: number;
      chunks?: number;
    });

export interface GenerateRevisionsPayload {
  target_file_id: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
}

export interface GenerateRevisionsResponse {
  target_file_id: string;
  target_filename: string;
  revised_text: string;
  word_count: number;
  character_count: number;
  tokens: number;
  latency_ms: number;
  referenced_documents: string[];
}

export interface UploadFileResponse {
  id: string;
  name: string;
  size: string;
  role: DocumentRole;
  chunks: number;
  uploaded_at: string;
  status: 'ready' | 'embedding' | 'queued';
}
