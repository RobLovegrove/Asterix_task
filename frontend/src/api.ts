import type { Letter } from './types';
import { getIdToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL as string;

async function apiHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token,
  };
}

export async function initiateUpload(file: File): Promise<{ letterId: string; uploadUrl: string }> {
  const response = await fetch(`${API_URL}/letters`, {
    method: 'POST',
    headers: await apiHeaders(),
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
  const response = await fetch(`${API_URL}/letters`, { headers: await apiHeaders() });
  if (!response.ok) throw new Error('Failed to fetch letters');
  return response.json();
}

export async function getLetter(letterId: string): Promise<Letter> {
  const response = await fetch(`${API_URL}/letters/${letterId}`, { headers: await apiHeaders() });
  if (!response.ok) throw new Error('Failed to fetch letter');
  return response.json();
}

export async function deleteLetter(letterId: string): Promise<void> {
  const response = await fetch(`${API_URL}/letters/${letterId}`, {
    method: 'DELETE',
    headers: await apiHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete letter');
}
