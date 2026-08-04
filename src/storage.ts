// Journal records live in IndexedDB so larger base64 photos do not hit localStorage limits.
const DB_NAME = 'path-journal-db';
const STORE_NAME = 'state';
const STATE_KEY = 'current';
const DRAFT_KEY = 'entry-draft';

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export async function loadState<T>(fallback: T): Promise<T> {
  try {
    const database = await openDatabase();
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (result) return result;

    const legacy = localStorage.getItem('path-journal-v1');
    return legacy ? (JSON.parse(legacy) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveState<T>(value: T): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, STATE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadPendingDraft<T>(): Promise<T | null> {
  try {
    const database = await openDatabase();
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DRAFT_KEY);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return result ?? null;
  } catch {
    return null;
  }
}

export async function savePendingDraft<T>(value: T): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function clearPendingDraft(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
