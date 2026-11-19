import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradeTelemetry, StudyDeck } from '../types/study';

const STORAGE_KEY = '@recalyn/api_base_url_override';

export const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.16:8000';

let activeBaseUrl = DEFAULT_API_BASE_URL;
let overrideActive = false;

export function normalizeServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export async function initApiBaseUrl(): Promise<{ url: string; isOverride: boolean }> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      activeBaseUrl = normalizeServerUrl(saved);
      overrideActive = true;
      return { url: activeBaseUrl, isOverride: true };
    }
  } catch {
    // Fall back silently to default URL if storage read fails
  }
  activeBaseUrl = normalizeServerUrl(DEFAULT_API_BASE_URL);
  overrideActive = false;
  return { url: activeBaseUrl, isOverride: false };
}

export function getApiBaseUrl(): string {
  return activeBaseUrl;
}

export function isApiUrlOverridden(): boolean {
  return overrideActive;
}

export async function setApiBaseUrlOverride(newUrl: string): Promise<string> {
  const cleaned = normalizeServerUrl(newUrl);
  if (!/^https?:\/\/.+/i.test(cleaned)) {
    throw new Error('URL must start with http:// or https://');
  }
  await AsyncStorage.setItem(STORAGE_KEY, cleaned);
  activeBaseUrl = cleaned;
  overrideActive = true;
  return activeBaseUrl;
}

export async function resetApiBaseUrlOverride(): Promise<string> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  activeBaseUrl = normalizeServerUrl(DEFAULT_API_BASE_URL);
  overrideActive = false;
  return activeBaseUrl;
}

export async function testServerHealth(candidateUrl: string): Promise<void> {
  const cleaned = normalizeServerUrl(candidateUrl);
  if (!/^https?:\/\/.+/i.test(cleaned)) {
    throw new Error('URL must start with http:// or https://');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${cleaned}/health`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Server responded with HTTP ${res.status}`);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Connection timed out after 5s');
    }
    throw new Error(err?.message || 'Unable to reach /health endpoint');
  } finally {
    clearTimeout(timeout);
  }
}

export interface GradeApiResponse extends GradeTelemetry {
  streakDays: number;
}

export async function fetchDecks(): Promise<StudyDeck[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/decks`);
  if (!res.ok) throw new Error(`Failed to fetch decks (${res.status})`);
  return res.json();
}

export async function fetchGrade(): Promise<GradeApiResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/grade`);
  if (!res.ok) throw new Error(`Failed to fetch grade (${res.status})`);
  return res.json();
}

async function uriToBase64(uri: string): Promise<string> {
  const blob: Blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Failed to read selected PDF file.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to encode PDF file.'));
    reader.readAsDataURL(blob);
  });
}

export async function ingestPdfFile(uri: string, name: string): Promise<StudyDeck> {
  const pdfBase64 = await uriToBase64(uri);

  const res = await fetch(`${getApiBaseUrl()}/api/v1/decks/ingest-base64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: name || 'document.pdf',
      pdf_base64: pdfBase64,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Server error' }));
    throw new Error(err.detail || 'Failed to ingest PDF');
  }

  const data = await res.json();
  return data.deck;
}

export async function deleteDeckApi(deckId: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/decks/${deckId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete deck (${res.status})`);
}

export async function syncCardRating(cardId: string, rating: 1 | 2 | 3 | 4): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/cards/${cardId}/rate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error(`Failed to save card rating (${res.status})`);
}

export async function syncQuizScore(deckId: string, scorePercent: number): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/decks/${deckId}/quiz-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score_percent: scorePercent }),
  });
  if (!res.ok) throw new Error(`Failed to save quiz score (${res.status})`);
}
