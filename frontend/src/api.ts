import type { Letter } from './types';

const API_URL = import.meta.env.VITE_API_URL as string;

export async function initiateUpload(file: File): Promise<{ letterId: string; uploadUrl: string }> {
  const response = await fetch(`${API_URL}/letters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to initiate upload');
  }

  return response.json();
}

export async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error('Failed to upload file to storage');
  }
}

export async function getLetters(): Promise<Letter[]> {
  const response = await fetch(`${API_URL}/letters`);
  if (!response.ok) throw new Error('Failed to fetch letters');
  return response.json();
}

export async function getLetter(letterId: string): Promise<Letter> {
  const response = await fetch(`${API_URL}/letters/${letterId}`);
  if (!response.ok) throw new Error('Failed to fetch letter');
  return response.json();
}
