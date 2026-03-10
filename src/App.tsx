import { useEffect } from 'react';
import Layout from './components/Layout';
import { useAI } from './hooks/useAI';

function App() {
  useEffect(() => {
    const requestPersist = async () => {
      if (navigator.storage && navigator.storage.persist) {
        try {
          const isPersisted = await navigator.storage.persist();
          console.log(`Storage persistence requested: ${isPersisted ? 'granted' : 'denied'}`);
        } catch (error) {
          console.error('Failed to request storage persistence', error);
        }
      }
    };
    requestPersist();
  }, []);

  const { status, progress } = useAI();

  return (
    <>
      <Layout />
      {status === 'downloading' && progress && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16,
          background: 'var(--bg-card)', padding: '12px 16px',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 9999, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px'
        }}>
          <strong>AIモデル準備中... ({Math.round(progress.progress)}%)</strong>
          <span style={{ color: 'var(--text-muted)' }}>{progress.file}</span>
        </div>
      )}
    </>
  );
}

export default App;
