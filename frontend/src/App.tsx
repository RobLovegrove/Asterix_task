import { useState, useEffect, useCallback } from 'react';
import { UploadForm } from './components/UploadForm';
import { LetterList } from './components/LetterList';
import { LetterDetail } from './components/LetterDetail';
import { AuthPage } from './components/AuthPage';
import { getLetters, getLetter, deleteLetter } from './api';
import { getCurrentUser, signOut } from './auth';
import type { Letter } from './types';
import './App.css';

const POLL_INTERVAL_MS = 3000;

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loadingLetterId, setLoadingLetterId] = useState<string | null>(null);

  const selectedLetter = letters.find((l) => l.letterId === selectedId) ?? null;

  useEffect(() => {
    getCurrentUser()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

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
    if (authenticated) fetchLetters();
  }, [authenticated, fetchLetters]);

  useEffect(() => {
    const pending = letters.filter(
      (l) => l.status === 'pending' || l.status === 'processing'
    );
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const updated = await Promise.all(pending.map((l) => getLetter(l.letterId)));
        setLetters((prev) =>
          prev.map((l) => updated.find((u) => u.letterId === l.letterId) ?? l)
        );
      } catch {
        // transient network failure — interval will retry on next tick
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [letters]);

  async function handleSelect(letterId: string) {
    setSelectedId(letterId);
    setLoadingLetterId(letterId);
    try {
      const full = await getLetter(letterId);
      setLetters((prev) => prev.map((l) => l.letterId === letterId ? full : l));
    } catch {
      // fall back to list data already in state
    } finally {
      setLoadingLetterId(null);
    }
  }

  async function handleDelete(letterId: string): Promise<void> {
    setDeleteError(null);
    await deleteLetter(letterId);
    setLetters((prev) => prev.filter((l) => l.letterId !== letterId));
    if (selectedId === letterId) setSelectedId(null);
  }

  function handleDeleteError() {
    setDeleteError('Failed to delete letter. Please try again.');
  }

  function handleUploadComplete(letterId: string) {
    fetchLetters();
    setSelectedId(letterId);
  }

  async function handleSignOut() {
    await signOut();
    setAuthenticated(false);
    setLetters([]);
    setSelectedId(null);
  }

  if (authenticated === null) return null;

  if (!authenticated) {
    return <AuthPage onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Clinical Letters</h1>
        <button className="sign-out-button" onClick={handleSignOut}>Sign out</button>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <UploadForm onUploadComplete={handleUploadComplete} />
          <div className="letter-list-section">
            <h2>Letters</h2>
            {deleteError && <p className="error-text">{deleteError}</p>}
            {loadError ? (
              <p className="error-text">{loadError}</p>
            ) : (
              <LetterList
                letters={letters}
                selectedId={selectedId}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onDeleteError={handleDeleteError}
              />
            )}
          </div>
        </aside>

        <section className="detail-panel">
          {loadingLetterId ? (
            <div className="processing-state">
              <div className="spinner" />
              <p>Loading letter...</p>
            </div>
          ) : selectedLetter ? (
            <LetterDetail letter={selectedLetter} />
          ) : (
            <p className="empty-state">Select a letter to view its summary.</p>
          )}
        </section>
      </main>
    </div>
  );
}
