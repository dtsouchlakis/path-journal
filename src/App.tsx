import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  IonActionSheet,
  IonAlert,
  IonApp,
  IonContent,
  IonIcon,
  IonToast,
} from '@ionic/react';
import {
  add,
  createOutline,
  personCircleOutline,
  restaurantOutline,
  trashOutline,
} from 'ionicons/icons';
import type { EntryDraft, JournalEntry, JournalUser, PendingEntryDraft, StoredState } from './domain/journal';
import {
  calculateWeeklyPatterns,
  createEmptyDraft,
  createId,
  groupEntriesByDay,
  latestDayGroups,
} from './domain/journal';
import { journalRepository, type MigrationProgress } from './data/journalRepository';
import { EntryEditorModal } from './features/entries/EntryEditorModal';
import {
  acknowledgeNativePhoto,
  getPendingNativePhoto,
  nativePhotoToBlob,
  optimizePhoto,
  takeNativePhoto,
} from './features/entries/photoService';
import { JournalTimeline } from './features/journal/JournalTimeline';
import { PatternsModal } from './features/patterns/PatternsModal';
import { PauseModal } from './features/pause/PauseModal';
import { UserModals } from './features/users/UserModals';

const DAYS_PER_PAGE = 3;

function App() {
  const [state, setState] = useState<StoredState>({ activeUserId: null, users: [] });
  const [hydrated, setHydrated] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress>({ completed: 0, total: 0 });

  const [draft, setDraft] = useState<EntryDraft>(createEmptyDraft);
  const [draftActive, setDraftActive] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [originalImageId, setOriginalImageId] = useState<string | undefined>();
  const [showEntryEditor, setShowEntryEditor] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const [showPause, setShowPause] = useState(false);
  const [pauseReason, setPauseReason] = useState('Physically hungry');
  const [pauseEndsAt, setPauseEndsAt] = useState<number | null>(null);
  const [pauseRemaining, setPauseRemaining] = useState(600);
  const [showPatterns, setShowPatterns] = useState(false);

  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  const [visibleDayCount, setVisibleDayCount] = useState(DAYS_PER_PAGE);
  const [entryMenuId, setEntryMenuId] = useState<string | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const journalContent = useRef<HTMLIonContentElement>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const migrated = await journalRepository.migrateLegacyImages(setMigrationProgress);
        await journalRepository.removeUnreferencedImages(migrated.state, migrated.pendingDraft);
        setState(migrated.state);
        if (migrated.pendingDraft && migrated.state.users.some((user) => user.id === migrated.pendingDraft?.userId)) {
          const { image: _legacyImage, ...restoredDraft } = migrated.pendingDraft.draft;
          setDraft({ ...createEmptyDraft(), ...restoredDraft });
          setEditingEntryId(migrated.pendingDraft.editingEntryId);
          setOriginalImageId(migrated.pendingDraft.originalImageId);
          setDraftActive(true);
        }
        setShowUserForm(migrated.state.users.length === 0);
      } catch {
        // A malformed legacy photo must never make the rest of the journal inaccessible.
        const fallbackState = await journalRepository.loadState();
        const fallbackDraft = await journalRepository.loadPendingDraft();
        setState(fallbackState);
        if (fallbackDraft) {
          const { image: _legacyImage, ...restoredDraft } = fallbackDraft.draft;
          setDraft({ ...createEmptyDraft(), ...restoredDraft });
          setEditingEntryId(fallbackDraft.editingEntryId);
          setOriginalImageId(fallbackDraft.originalImageId);
          setDraftActive(true);
        }
        setShowUserForm(fallbackState.users.length === 0);
        setToast('Some older photos could not be optimized yet; your entries were kept.');
      } finally {
        setHydrated(true);
      }
    };
    void bootstrap();
  }, []);

  const activeUser = state.users.find((user) => user.id === state.activeUserId) ?? state.users[0] ?? null;

  useEffect(() => {
    if (!hydrated) return;
    void journalRepository.saveState(state).catch(() => setToast('Could not save changes on this device'));
  }, [hydrated, state]);

  useEffect(() => {
    if (!activeUser || state.activeUserId === activeUser.id) return;
    setState((current) => ({ ...current, activeUserId: activeUser.id }));
  }, [activeUser, state.activeUserId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!draftActive || !activeUser) {
      void journalRepository.clearPendingDraft();
      return;
    }
    const pending: PendingEntryDraft = {
      userId: activeUser.id,
      editingEntryId,
      originalImageId,
      draft,
    };
    void journalRepository.savePendingDraft(pending);
  }, [activeUser?.id, draft, draftActive, editingEntryId, hydrated, originalImageId]);

  useEffect(() => {
    if (!pauseEndsAt) return;
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((pauseEndsAt - Date.now()) / 1000));
      setPauseRemaining(remaining);
      if (remaining === 0) setPauseEndsAt(null);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [pauseEndsAt]);

  const allDayGroups = useMemo(() => groupEntriesByDay(activeUser?.entries ?? []), [activeUser]);
  const visibleDayGroups = useMemo(() => latestDayGroups(activeUser?.entries ?? [], visibleDayCount), [activeUser, visibleDayCount]);
  const weeklyPatterns = useMemo(() => calculateWeeklyPatterns(activeUser?.entries ?? []), [activeUser]);

  useEffect(() => setVisibleDayCount(DAYS_PER_PAGE), [activeUser?.id]);

  useEffect(() => {
    if (!hydrated || !activeUser?.entries.length) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => { void journalContent.current?.scrollToBottom(0); });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [activeUser?.id, activeUser?.entries.length, hydrated]);

  const loadOlderDays = async () => {
    const scrollElement = await journalContent.current?.getScrollElement();
    const previousHeight = scrollElement?.scrollHeight ?? 0;
    const previousTop = scrollElement?.scrollTop ?? 0;
    setVisibleDayCount((count) => count + DAYS_PER_PAGE);
    // Prepending dates changes scrollHeight. Compensating for that delta leaves
    // the entry being read in exactly the same visual position.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (scrollElement) scrollElement.scrollTop = previousTop + scrollElement.scrollHeight - previousHeight;
    }));
  };

  const saveStateNow = async (nextState: StoredState) => {
    await journalRepository.saveState(nextState);
    setState(nextState);
  };

  const openNewEntry = () => {
    if (draftActive) {
      setShowEntryEditor(true);
      return;
    }
    setPauseReason('Physically hungry');
    setPauseEndsAt(null);
    setPauseRemaining(600);
    setShowPause(true);
  };

  const continueToNewEntry = () => {
    if (!draftActive) {
      setDraft(createEmptyDraft());
      setEditingEntryId(null);
      setOriginalImageId(undefined);
      setDraftActive(true);
    }
    setShowPause(false);
    setShowEntryEditor(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    const { image: _legacyImage, ...entryWithoutLegacyImage } = entry;
    setDraft({
      ...createEmptyDraft(),
      ...entryWithoutLegacyImage,
      eatenAt: entry.eatenAt.slice(0, 16),
      imageId: entry.imageId,
    });
    setEditingEntryId(entry.id);
    setOriginalImageId(entry.imageId);
    setDraftActive(true);
    setEntryMenuId(null);
    setShowEntryEditor(true);
  };

  const persistCurrentDraft = async () => {
    if (!activeUser) return;
    await journalRepository.savePendingDraft({ userId: activeUser.id, editingEntryId, originalImageId, draft });
  };

  const capturePhoto = async () => {
    await persistCurrentDraft();
    setCameraActive(true);
    // Give React two paints to unmount timeline images and revoke their object URLs
    // before CameraX allocates preview buffers on memory-constrained Android devices.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    try {
      const nativePhoto = await takeNativePhoto();
      const photoBlob = await nativePhotoToBlob(nativePhoto);
      await attachPhoto(photoBlob, '', nativePhoto.mimeType ?? 'image/jpeg');
      // The native cache remains recoverable until IndexedDB has both the image
      // blob and its draft reference. Only then is it safe to remove the file.
      await acknowledgeNativePhoto();
    } finally {
      setCameraActive(false);
    }
  };

  const attachPhoto = async (input: Blob, name = '', format = '') => {
    if (!activeUser) return;
    const optimized = await optimizePhoto(input, name, format);
    const newImageId = await journalRepository.storeImage(optimized);
    const previousImageId = draft.imageId;
    const nextDraft = { ...draft, imageId: newImageId };
    // Persist the small image reference before updating the preview. If Android
    // recreates the process immediately afterward, the draft still finds its blob.
    await journalRepository.savePendingDraft({ userId: activeUser.id, editingEntryId, originalImageId, draft: nextDraft });
    setDraft(nextDraft);
    if (previousImageId && previousImageId !== originalImageId) await journalRepository.removeImages([previousImageId]);
  };

  const removeDraftPhoto = async () => {
    if (!activeUser || !draft.imageId) return;
    const removedImageId = draft.imageId;
    const nextDraft = { ...draft, imageId: undefined };
    await journalRepository.savePendingDraft({ userId: activeUser.id, editingEntryId, originalImageId, draft: nextDraft });
    setDraft(nextDraft);
    if (removedImageId !== originalImageId) await journalRepository.removeImages([removedImageId]);
  };

  const cancelEntry = async () => {
    if (draft.imageId && draft.imageId !== originalImageId) await journalRepository.removeImages([draft.imageId]);
    await journalRepository.clearPendingDraft();
    setDraft(createEmptyDraft());
    setDraftActive(false);
    setEditingEntryId(null);
    setOriginalImageId(undefined);
    setShowEntryEditor(false);
  };

  const saveEntry = async () => {
    if (!activeUser || (!draft.description.trim() && !draft.imageId)) {
      setToast('Add a description or photo first');
      return;
    }
    const description = draft.description.trim();
    const entries = editingEntryId
      ? activeUser.entries.map((entry) => entry.id === editingEntryId ? { ...entry, ...draft, description, image: undefined } : entry)
      : [...activeUser.entries, { ...draft, description, id: createId() }];
    const nextState = {
      ...state,
      users: state.users.map((user) => user.id === activeUser.id ? { ...user, entries } : user),
    };
    await saveStateNow(nextState);
    if (originalImageId && originalImageId !== draft.imageId) await journalRepository.removeImages([originalImageId]);
    await journalRepository.clearPendingDraft();
    setDraft(createEmptyDraft());
    setDraftActive(false);
    setEditingEntryId(null);
    setOriginalImageId(undefined);
    setShowEntryEditor(false);
    setToast(editingEntryId ? 'Entry updated' : 'Added to your journal');
  };

  const confirmDeleteEntry = async () => {
    if (!activeUser || !deleteEntryId) return;
    const entry = activeUser.entries.find((item) => item.id === deleteEntryId);
    const nextState = {
      ...state,
      users: state.users.map((user) => user.id === activeUser.id
        ? { ...user, entries: user.entries.filter((item) => item.id !== deleteEntryId) }
        : user),
    };
    await saveStateNow(nextState);
    await journalRepository.removeImages([entry?.imageId]);
    setDeleteEntryId(null);
    setToast('Entry deleted');
  };

  const saveUser = async () => {
    const name = userName.trim();
    if (!name) return;
    let nextState: StoredState;
    if (editingUserId) {
      nextState = { ...state, users: state.users.map((user) => user.id === editingUserId ? { ...user, name } : user) };
      setToast('User name updated');
    } else {
      const user: JournalUser = { id: createId(), name, entries: [] };
      nextState = { users: [...state.users, user], activeUserId: user.id };
      setToast(`Welcome, ${name}`);
    }
    await saveStateNow(nextState);
    setUserName('');
    setEditingUserId(null);
    setShowUserForm(false);
    setShowUserPicker(false);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    const user = state.users.find((item) => item.id === deleteUserId);
    const users = state.users.filter((item) => item.id !== deleteUserId);
    const nextState = { users, activeUserId: users[0]?.id ?? null };
    await saveStateNow(nextState);
    await journalRepository.removeImages(user?.entries.map((entry) => entry.imageId) ?? []);
    setDeleteUserId(null);
    setShowUserPicker(false);
    setToast('User deleted from this device');
  };

  useEffect(() => {
    if (!hydrated || !activeUser || !Capacitor.isNativePlatform()) return;
    const restorePhoto = async () => {
      try {
        const nativePhoto = await getPendingNativePhoto();
        if (!nativePhoto.path) return;
        setCameraActive(true);
        const photoBlob = await nativePhotoToBlob(nativePhoto);
        await attachPhoto(photoBlob, '', nativePhoto.mimeType ?? 'image/jpeg');
        await acknowledgeNativePhoto();
        setDraftActive(true);
        setShowPause(false);
        setShowEntryEditor(true);
      } catch {
        setToast('Your captured photo is still waiting and will be recovered next time');
      } finally {
        setCameraActive(false);
      }
    };
    void restorePhoto();
  }, [hydrated, activeUser?.id]);

  if (!hydrated) {
    const percentage = migrationProgress.total
      ? Math.round((migrationProgress.completed / migrationProgress.total) * 100)
      : 0;
    return (
      <IonApp><div className="launch-screen migration-screen"><span className="welcome-logo" aria-hidden="true"><i /><b /></span><strong>Daymark</strong>{migrationProgress.total > 0 && <><p>Optimizing your journal</p><div className="migration-track"><i style={{ width: `${percentage}%` }} /></div><small>{migrationProgress.completed} of {migrationProgress.total} photos</small></>}</div></IonApp>
    );
  }

  return (
    <IonApp>
      <IonContent ref={journalContent} fullscreen className="journal-page">
        {cameraActive ? <div className="capture-memory-screen"><span className="welcome-logo" aria-hidden="true"><i /><b /></span><p>Preparing your photo…</p></div> : <JournalTimeline
          activeUser={activeUser}
          dayGroups={visibleDayGroups}
          weeklyEntryCount={weeklyPatterns.entries.length}
          weeklyTrigger={weeklyPatterns.trigger}
          hasOlderDays={visibleDayCount < allDayGroups.length}
          onLoadOlderDays={() => { void loadOlderDays(); }}
          onAddEntry={openNewEntry}
          onOpenPatterns={() => setShowPatterns(true)}
          onOpenUsers={() => setShowUserPicker(true)}
          onOpenEntryMenu={(entry) => setEntryMenuId(entry.id)}
        />}
      </IonContent>

      <nav className="bottom-nav">
        <div className="nav-item active"><IonIcon icon={restaurantOutline} /><span>Journal</span></div>
        <button className="add-button" aria-label="Add journal entry" onClick={openNewEntry} disabled={!activeUser}><IonIcon icon={add} /></button>
        <button className="nav-item" onClick={() => setShowUserPicker(true)}><IonIcon icon={personCircleOutline} /><span>Select user</span></button>
      </nav>

      {!cameraActive && <EntryEditorModal
        isOpen={showEntryEditor}
        editing={Boolean(editingEntryId)}
        draft={draft}
        onDraftChange={setDraft}
        onTakePhoto={capturePhoto}
        onPhotoInput={attachPhoto}
        onRemovePhoto={removeDraftPhoto}
        onCancel={() => { void cancelEntry(); }}
        onSave={() => { void saveEntry(); }}
        onDismiss={() => setShowEntryEditor(false)}
        onError={setToast}
      />}
      <PauseModal isOpen={showPause} reason={pauseReason} endsAt={pauseEndsAt} remaining={pauseRemaining} onReasonChange={setPauseReason} onStart={() => { setPauseRemaining(600); setPauseEndsAt(Date.now() + 10 * 60 * 1000); }} onContinue={continueToNewEntry} onDismiss={() => { setShowPause(false); setPauseEndsAt(null); }} />
      <PatternsModal isOpen={showPatterns} userName={activeUser?.name} patterns={weeklyPatterns} onDismiss={() => setShowPatterns(false)} />
      <UserModals
        users={state.users}
        activeUserId={activeUser?.id ?? null}
        pickerOpen={showUserPicker}
        formOpen={showUserForm}
        editingUserId={editingUserId}
        userName={userName}
        onUserNameChange={setUserName}
        onSelect={(userId) => { setState({ ...state, activeUserId: userId }); setShowUserPicker(false); }}
        onCreate={() => { setEditingUserId(null); setUserName(''); setShowUserForm(true); }}
        onEdit={(user) => { setEditingUserId(user.id); setUserName(user.name); setShowUserForm(true); }}
        onDelete={setDeleteUserId}
        onSave={() => { void saveUser(); }}
        onClosePicker={() => setShowUserPicker(false)}
        onCloseForm={() => setShowUserForm(false)}
      />

      <IonActionSheet isOpen={Boolean(entryMenuId)} onDidDismiss={() => setEntryMenuId(null)} header="Entry options" buttons={[
        { text: 'Edit entry', icon: createOutline, handler: () => { const entry = activeUser?.entries.find((item) => item.id === entryMenuId); if (entry) openEditEntry(entry); } },
        { text: 'Delete entry', role: 'destructive', icon: trashOutline, handler: () => { setDeleteEntryId(entryMenuId); setEntryMenuId(null); } },
        { text: 'Cancel', role: 'cancel' },
      ]} />
      <IonAlert isOpen={Boolean(deleteEntryId)} onDidDismiss={() => setDeleteEntryId(null)} header="Delete this entry?" message="This permanently removes the entry and its local photo." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'destructive', handler: () => { void confirmDeleteEntry(); } }]} />
      <IonAlert isOpen={Boolean(deleteUserId)} onDidDismiss={() => setDeleteUserId(null)} header="Delete this user?" message="All of this user's journal entries and photos will be permanently removed." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete user', role: 'destructive', handler: () => { void confirmDeleteUser(); } }]} />
      <IonToast isOpen={Boolean(toast)} message={toast} duration={2200} position="top" onDidDismiss={() => setToast('')} />
    </IonApp>
  );
}

export default App;
