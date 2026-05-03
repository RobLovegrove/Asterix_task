import type { Letter } from '../types';

interface Props {
  letters: Letter[];
  selectedId: string | null;
  onSelect: (letterId: string) => void;
}

export function LetterList({ letters, selectedId, onSelect }: Props) {
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
          <div className="letter-item-name">{letter.fileName}</div>
          <div className="letter-item-meta">
            <StatusBadge status={letter.status} />
            <span>{new Date(letter.uploadedAt).toLocaleString()}</span>
          </div>
          {letter.nhsNumber && (
            <div className="letter-item-nhs">NHS: {formatNhsNumber(letter.nhsNumber)}</div>
          )}
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
