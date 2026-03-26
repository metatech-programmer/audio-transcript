// Minimal IndexedDB helper for queued failed chunks
const DB_NAME = 'audio-transcribe-db';
const STORE_NAME = 'failedChunks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFailedChunk(entry: { id: string; sessionId: string; chunkIndex: number; blob: Blob; final?: boolean; language?: string; createdAt?: string }) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...entry, createdAt: entry.createdAt || new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllFailedChunks() {
  const db = await openDB();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFailedChunk(id: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearFailedChunksBySession(sessionId?: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = async () => {
      try {
        const items = req.result || [];
        for (const item of items) {
          if (!sessionId || item.sessionId === sessionId) {
            store.delete(item.id);
          }
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// --- Transcript Chunks Store ---
const TRANSCRIPT_STORE = 'transcriptChunks';

function openTranscriptDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TRANSCRIPT_STORE)) {
        db.createObjectStore(TRANSCRIPT_STORE, { keyPath: 'id' });
      }
      // Keep failedChunks for backward compatibility
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTranscriptChunk(entry: { id: string; sessionId: string; chunkIndex: number; text: string; createdAt?: string; status?: string }) {
  const db = await openTranscriptDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRANSCRIPT_STORE, 'readwrite');
    const store = tx.objectStore(TRANSCRIPT_STORE);
    store.put({ ...entry, createdAt: entry.createdAt || new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTranscriptChunksBySession(sessionId: string) {
  const db = await openTranscriptDB();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(TRANSCRIPT_STORE, 'readonly');
    const store = tx.objectStore(TRANSCRIPT_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      resolve(all.filter((item: any) => item.sessionId === sessionId));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearTranscriptChunksBySession(sessionId: string) {
  const db = await openTranscriptDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRANSCRIPT_STORE, 'readwrite');
    const store = tx.objectStore(TRANSCRIPT_STORE);
    const req = store.getAll();
    req.onsuccess = async () => {
      try {
        const items = req.result || [];
        for (const item of items) {
          if (item.sessionId === sessionId) {
            store.delete(item.id);
          }
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
