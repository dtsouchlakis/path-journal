import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PendingEntryDraft, StoredState } from '../domain/journal';
import { createEmptyDraft } from '../domain/journal';
import { journalRepository } from './journalRepository';

const legacyJpeg = `data:image/jpeg;base64,${btoa('small-image-bytes')}`;

beforeEach(async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  });
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('path-journal-db');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

describe('legacy image migration', () => {
  it('atomically replaces entry base64 with a stored blob reference', async () => {
    const state: StoredState = {
      activeUserId: 'user-1',
      users: [{
        id: 'user-1',
        name: 'Alex',
        entries: [{ ...createEmptyDraft(), id: 'entry-1', description: 'Lunch', image: legacyJpeg }],
      }],
    };
    await journalRepository.saveState(state);
    const progress: Array<[number, number]> = [];
    const migrated = await journalRepository.migrateLegacyImages(({ completed, total }) => progress.push([completed, total]));
    const result = migrated.state.users[0].entries[0];

    expect(result.image).toBeUndefined();
    expect(result.imageId).toBe('legacy-entry-entry-1');
    expect(await journalRepository.loadImage(result.imageId!)).toBeInstanceOf(Blob);
    expect(progress).toEqual([[0, 1], [1, 1]]);
  });

  it('migrates a pending draft without changing its other fields', async () => {
    await journalRepository.saveState({ activeUserId: 'user-1', users: [{ id: 'user-1', name: 'Alex', entries: [] }] });
    const pending: PendingEntryDraft = {
      userId: 'user-1',
      editingEntryId: null,
      draft: { ...createEmptyDraft(), description: 'Unsaved dinner', image: legacyJpeg },
    };
    await journalRepository.savePendingDraft(pending);
    const migrated = await journalRepository.migrateLegacyImages(() => undefined);

    expect(migrated.pendingDraft?.draft.description).toBe('Unsaved dinner');
    expect(migrated.pendingDraft?.draft.image).toBeUndefined();
    expect(await journalRepository.loadImage(migrated.pendingDraft!.draft.imageId!)).toBeInstanceOf(Blob);
  });

  it('is resumable and does not migrate an already completed photo twice', async () => {
    const state: StoredState = {
      activeUserId: 'user-1',
      users: [{ id: 'user-1', name: 'Alex', entries: [{ ...createEmptyDraft(), id: 'entry-1', description: '', image: legacyJpeg }] }],
    };
    await journalRepository.saveState(state);
    await journalRepository.migrateLegacyImages(() => undefined);
    const secondRunProgress: Array<[number, number]> = [];
    const secondRun = await journalRepository.migrateLegacyImages(({ completed, total }) => secondRunProgress.push([completed, total]));

    expect(secondRun.state.users[0].entries[0].imageId).toBe('legacy-entry-entry-1');
    expect(secondRunProgress).toEqual([[0, 0]]);
  });

  it('keeps referenced images while cleaning only orphan blobs', async () => {
    const keptId = await journalRepository.storeImage(new Blob(['kept']), 'kept');
    await journalRepository.storeImage(new Blob(['orphan']), 'orphan');
    const state: StoredState = {
      activeUserId: 'user-1',
      users: [{ id: 'user-1', name: 'Alex', entries: [{ ...createEmptyDraft(), id: 'entry-1', description: '', imageId: keptId }] }],
    };
    await journalRepository.removeUnreferencedImages(state, null);
    expect(await journalRepository.loadImage('kept')).toBeInstanceOf(Blob);
    expect(await journalRepository.loadImage('orphan')).toBeNull();
  });
});
