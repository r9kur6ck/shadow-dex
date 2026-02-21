import { useEffect } from 'react';
import Layout from './components/Layout';

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

  return (
    <Layout />
  );
}

export default App;
