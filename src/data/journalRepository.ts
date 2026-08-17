import type { PendingEntryDraft, StoredState } from '../domain/journal';
import { createId, normalizeState } from '../domain/journal';

const DATABASE_NAME = 'path-journal-db';
const DATABASE_VERSION = 2;
const STATE_STORE = 'state';
const IMAGE_STORE = 'images';
const STATE_KEY = 'current';
const DRAFT_KEY = 'entry-draft';

export type MigrationProgress = { completed: number; total: number };

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE);
    if (!database.objectStoreNames.contains(IMAGE_STORE)) database.createObjectStore(IMAGE_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readValue = async <T>(storeName: string, key: string): Promise<T | null> => {
  const database = await openDatabase();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
};

const writeValue = async <T>(storeName: string, key: string, value: T) => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

const dataUrlToBlob = (dataUrl: string) => {
  const [metadata, encoded] = dataUrl.split(',', 2);
  if (!metadata || !encoded) throw new Error('Invalid legacy image data');
  const mimeType = metadata.match(/^data:([^;]+)/)?.[1] ?? 'image/jpeg';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
};

const commitEntryMigration = async (state: StoredState, imageId: string, blob: Blob) => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      // The image and its reference share one transaction: interruption keeps either
      // the complete old representation or the complete new one, never half of each.
      const transaction = database.transaction([STATE_STORE, IMAGE_STORE], 'readwrite');
      transaction.objectStore(IMAGE_STORE).put(blob, imageId);
      transaction.objectStore(STATE_STORE).put(state, STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

const commitDraftMigration = async (draft: PendingEntryDraft, imageId: string, blob: Blob) => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STATE_STORE, IMAGE_STORE], 'readwrite');
      transaction.objectStore(IMAGE_STORE).put(blob, imageId);
      transaction.objectStore(STATE_STORE).put(draft, DRAFT_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

export const journalRepository = {
  async loadState(): Promise<StoredState> {
    const stored = await readValue<StoredState>(STATE_STORE, STATE_KEY);
    if (stored) return normalizeState(stored);
    const legacy = localStorage.getItem('path-journal-v1');
    return legacy ? normalizeState(JSON.parse(legacy) as StoredState) : { activeUserId: null, users: [] };
  },

  saveState(state: StoredState) {
    return writeValue(STATE_STORE, STATE_KEY, state);
  },

  loadPendingDraft() {
    return readValue<PendingEntryDraft>(STATE_STORE, DRAFT_KEY);
  },

  savePendingDraft(draft: PendingEntryDraft) {
    return writeValue(STATE_STORE, DRAFT_KEY, draft);
  },

  async clearPendingDraft() {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STATE_STORE, 'readwrite');
        transaction.objectStore(STATE_STORE).delete(DRAFT_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },

  async storeImage(blob: Blob, imageId = createId()) {
    await writeValue(IMAGE_STORE, imageId, blob);
    return imageId;
  },

  loadImage(imageId: string) {
    return readValue<Blob>(IMAGE_STORE, imageId);
  },

  async removeImages(imageIds: Array<string | undefined>) {
    const uniqueIds = [...new Set(imageIds.filter((value): value is string => Boolean(value)))];
    if (!uniqueIds.length) return;
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE, 'readwrite');
        const store = transaction.objectStore(IMAGE_STORE);
        uniqueIds.forEach((imageId) => store.delete(imageId));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },

  async migrateLegacyImages(onProgress: (progress: MigrationProgress) => void) {
    let state = await this.loadState();
    let pendingDraft = await this.loadPendingDraft();
    const entryCount = state.users.flatMap((user) => user.entries).filter((entry) => Boolean(entry.image)).length;
    const total = entryCount + (pendingDraft?.draft.image ? 1 : 0);
    let completed = 0;
    onProgress({ completed, total });

    for (let userIndex = 0; userIndex < state.users.length; userIndex += 1) {
      for (let entryIndex = 0; entryIndex < state.users[userIndex].entries.length; entryIndex += 1) {
        const entry = state.users[userIndex].entries[entryIndex];
        if (!entry.image) continue;
        try {
          const imageId = `legacy-entry-${entry.id}`;
          const blob = dataUrlToBlob(entry.image);
          const users = state.users.map((user, currentUserIndex) => currentUserIndex !== userIndex ? user : {
            ...user,
            entries: user.entries.map((currentEntry, currentEntryIndex) => currentEntryIndex !== entryIndex
              ? currentEntry
              : { ...currentEntry, imageId, image: undefined }),
          });
          const migratedState = { ...state, users };
          await commitEntryMigration(migratedState, imageId, blob);
          state = migratedState;
        } finally {
          completed += 1;
          onProgress({ completed, total });
        }
      }
    }

    if (pendingDraft?.draft.image) {
      try {
        const imageId = `legacy-draft-${pendingDraft.userId}-${pendingDraft.editingEntryId ?? 'new'}`;
        const blob = dataUrlToBlob(pendingDraft.draft.image);
        const { image: _legacyImage, ...draftWithoutImage } = pendingDraft.draft;
        const migratedDraft: PendingEntryDraft = {
          ...pendingDraft,
          draft: { ...draftWithoutImage, imageId },
        };
        await commitDraftMigration(migratedDraft, imageId, blob);
        pendingDraft = migratedDraft;
      } finally {
        completed += 1;
        onProgress({ completed, total });
      }
    }

    return { state: normalizeState(state), pendingDraft };
  },

  async removeUnreferencedImages(state: StoredState, pendingDraft: PendingEntryDraft | null) {
    const referenced = new Set<string>();
    state.users.forEach((user) => user.entries.forEach((entry) => entry.imageId && referenced.add(entry.imageId)));
    if (pendingDraft?.draft.imageId) referenced.add(pendingDraft.draft.imageId);

    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE, 'readwrite');
        const store = transaction.objectStore(IMAGE_STORE);
        const cursor = store.openKeyCursor();
        cursor.onsuccess = () => {
          if (!cursor.result) return;
          const imageId = String(cursor.result.key);
          if (!referenced.has(imageId)) store.delete(cursor.result.key);
          cursor.result.continue();
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },
};
