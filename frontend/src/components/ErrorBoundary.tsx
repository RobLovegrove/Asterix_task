import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(JSON.stringify({ event: 'react_error', error: error.message }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-page">
          <div className="auth-card">
            <h1>Clinical Letters</h1>
            <p style={{ color: '#64748b', marginBottom: '16px' }}>
              Something went wrong. Please refresh the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
