import type { Letter } from '../types';

interface Props {
  letters: Letter[];
  selectedId: string | null;
  onSelect: (letterId: string) => void;
  onDelete: (letterId: string) => void;
}

export function LetterList({ letters, selectedId, onSelect, onDelete }: Props) {
  if (letters.length === 0) {
    return <p className="empty-state">No letters uploaded yet.</p>;
  }

  return (
    <ul className="letter-list">
      {letters.map((letter) => (
        <li
          key={letter.letterId}
          className={`letter-item ${selectedId === letter.letterId ? 'selected' : ''}`}
          onClick={() => onSelect(letter.letterId)}
        >
          <div className="letter-item-header">
            <div className="letter-item-name">{letter.fileName}</div>
            <button
              className="delete-button"
              onClick={(e) => { e.stopPropagation(); onDelete(letter.letterId); }}
              aria-label="Delete letter"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zm2-4h2V8H9zm4 0h2V8h-2z"/>
              </svg>
            </button>
          </div>
          {letter.nhsNumber && (
            <div className="letter-item-nhs">NHS: {formatNhsNumber(letter.nhsNumber)}</div>
          )}
          <div className="letter-item-meta">
            <StatusBadge status={letter.status} />
            <span>{new Date(letter.uploadedAt).toLocaleString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: Letter['status'] }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

function formatNhsNumber(nhs: string): string {
  return `${nhs.slice(0, 3)} ${nhs.slice(3, 6)} ${nhs.slice(6)}`;
}
