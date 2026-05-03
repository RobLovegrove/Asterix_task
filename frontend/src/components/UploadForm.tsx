import { useState, useRef } from 'react';
import { initiateUpload, uploadToS3 } from '../api';

interface Props {
  onUploadComplete: (letterId: string) => void;
}

export function UploadForm({ onUploadComplete }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB');
      return;
    }

    setError(null);
    setStatus('uploading');
    setProgress(25);

    try {
      const { letterId, uploadUrl } = await initiateUpload(file);
      setProgress(50);

      await uploadToS3(uploadUrl, file);
      setProgress(100);

      setStatus('idle');
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
      onUploadComplete(letterId);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="upload-form">
      <h2>Upload Clinical Letter</h2>
      <label className="upload-label">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={status === 'uploading'}
        />
        <span className="upload-button">
          {status === 'uploading' ? 'Uploading...' : 'Choose PDF'}
        </span>
      </label>

      {status === 'uploading' && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
