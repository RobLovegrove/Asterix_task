import { useState, useEffect, useCallback } from 'react';
import { UploadForm } from './components/UploadForm';
import { LetterList } from './components/LetterList';
import { LetterDetail } from './components/LetterDetail';
import { getLetters, getLetter } from './api';
import type { Letter } from './types';
import './App.css';

const POLL_INTERVAL_MS = 3000;

export default function App() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedLetter = letters.find((l) => l.letterId === selectedId) ?? null;

  const fetchLetters = useCallback(async () => {
    try {
      const data = await getLetters();
      setLetters(data);
      setLoadError(null);
    } catch {
      setLoadError('Failed to load letters. Please refresh.');
    }
  }, []);

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  useEffect(() => {
    const pending = letters.filter(
      (l) => l.status === 'pending' || l.status === 'processing'
    );
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      const updated = await Promise.all(pending.map((l) => getLetter(l.letterId)));
      setLetters((prev) =>
        prev.map((l) => updated.find((u) => u.letterId === l.letterId) ?? l)
      );
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [letters]);

  async function handleSelect(letterId: string) {
    setSelectedId(letterId);
    try {
      const full = await getLetter(letterId);
      setLetters((prev) => prev.map((l) => l.letterId === letterId ? full : l));
    } catch {
      // fall back to list data already in state
    }
  }

  function handleUploadComplete(letterId: string) {
    fetchLetters();
    setSelectedId(letterId);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Clinical Letters</h1>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <UploadForm onUploadComplete={handleUploadComplete} />
          <div className="letter-list-section">
            <h2>Letters</h2>
            {loadError ? (
              <p className="error-text">{loadError}</p>
            ) : (
              <LetterList
                letters={letters}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            )}
          </div>
        </aside>

        <section className="detail-panel">
          {selectedLetter ? (
            <LetterDetail letter={selectedLetter} />
          ) : (
            <p className="empty-state">Select a letter to view its summary.</p>
          )}
        </section>
      </main>
    </div>
  );
}
