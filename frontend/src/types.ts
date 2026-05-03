export type LetterStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Letter {
  letterId: string;
  fileName: string;
  status: LetterStatus;
  uploadedAt: string;
  processedAt?: string;
  nhsNumber?: string;
  summary?: string;
  errorMessage?: string;
}
