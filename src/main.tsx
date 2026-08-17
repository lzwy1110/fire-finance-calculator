import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught render error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', maxWidth: '640px', margin: '40px auto', backgroundColor: '#18181b', color: '#fff', borderRadius: '16px', border: '1px solid #27272a', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#f43f5e', fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>⚠️ 網頁畫面載入異常</h2>
          <p style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '16px' }}>請嘗試點擊下方按鈕重新載入或重設本地資料快取：</p>
          <pre style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '8px', fontSize: '11px', color: '#fca5a5', overflowX: 'auto', marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
            {'\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
            >
              🔄 重新整理頁面
            </button>
            <button
              onClick={() => {
                if (window.confirm('確定要清除本地快取並重新載入嗎？')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
            >
              🧹 清除本地快取並重設
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
