import type { Letter } from '../types';
import Markdown from 'react-markdown';

interface Props {
  letter: Letter;
}

export function LetterDetail({ letter }: Props) {
  return (
    <div className="letter-detail">
      <h2>{letter.fileName}</h2>

      <div className="detail-meta">
        <span className={`status-badge status-${letter.status}`}>{letter.status}</span>
        <span>Uploaded: {new Date(letter.uploadedAt).toLocaleString()}</span>
        {letter.processedAt && (
          <span>Processed: {new Date(letter.processedAt).toLocaleString()}</span>
        )}
      </div>

      {letter.status === 'pending' || letter.status === 'processing' ? (
        <div className="processing-state">
          <div className="spinner" />
          <p>Processing letter — this may take a few seconds...</p>
        </div>
      ) : letter.status === 'failed' ? (
        <div className="error-box">
          <p>Processing failed.</p>
          {letter.errorMessage && <p className="error-detail">{letter.errorMessage}</p>}
        </div>
      ) : (
        <>
          <section className="detail-section">
            <h3>NHS Number</h3>
            <p className="nhs-number">
              {letter.nhsNumber
                ? `${letter.nhsNumber.slice(0, 3)} ${letter.nhsNumber.slice(3, 6)} ${letter.nhsNumber.slice(6)}`
                : 'Not found in letter'}
            </p>
          </section>

          <section className="detail-section">
            <h3>Summary</h3>
            <div className="summary-text">
              <Markdown>{letter.summary}</Markdown>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
