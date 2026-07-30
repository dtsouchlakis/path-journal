import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonActionSheet,
  IonAlert,
  IonApp,
  IonButton,
  IonContent,
  IonDatetime,
  IonIcon,
  IonModal,
  IonPopover,
  IonToast,
} from '@ionic/react';
import {
  add,
  cameraOutline,
  checkmarkCircle,
  chevronDown,
  close,
  createOutline,
  ellipsisHorizontal,
  fastFoodOutline,
  happyOutline,
  imageOutline,
  personAddOutline,
  personCircleOutline,
  restaurantOutline,
  trashOutline,
} from 'ionicons/icons';
import { loadState, saveState } from './storage';

type PathStatus = 'on' | 'off';

type JournalEntry = {
  id: string;
  description: string;
  image?: string;
  eatenAt: string;
  path: PathStatus;
  mood: string;
  place: string;
  after: string;
};

type JournalUser = {
  id: string;
  name: string;
  entries: JournalEntry[];
};

type StoredState = {
  activeUserId: string | null;
  users: JournalUser[];
};

type EntryDraft = Omit<JournalEntry, 'id'>;

const moods = ['Calm', 'Happy', 'Stressed', 'Bored', 'Sad', 'Celebrating', 'Tired'];
const places = ['Sitting at a table', 'On the sofa', 'Standing', 'At my desk', 'In the car', 'Out with others'];
const afterFeelings = ['Satisfied', 'Energized', 'Comforted', 'Still hungry', 'Too full', 'Embarrassed', 'Neutral'];

const nowLocalIso = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const emptyDraft = (): EntryDraft => ({
  description: '',
  image: undefined,
  eatenAt: nowLocalIso(),
  path: 'on',
  mood: 'Calm',
  place: 'Sitting at a table',
  after: 'Satisfied',
});

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatTime = (date: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));

const formatDay = (date: string) => {
  const input = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (input.toDateString() === today.toDateString()) return 'Today';
  if (input.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(input);
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function App() {
  const [state, setState] = useState<StoredState>({ activeUserId: null, users: [] });
  const [hydrated, setHydrated] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userName, setUserName] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [entryMenuId, setEntryMenuId] = useState<string | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadState<StoredState>({ activeUserId: null, users: [] }).then((stored) => {
      setState(stored);
      setShowUserForm(stored.users.length === 0);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state).catch(() => setToast('Could not save changes on this device'));
  }, [state, hydrated]);

  const activeUser = state.users.find((user) => user.id === state.activeUserId) ?? state.users[0] ?? null;

  useEffect(() => {
    if (activeUser && state.activeUserId !== activeUser.id) {
      setState((current) => ({ ...current, activeUserId: activeUser.id }));
    }
  }, [activeUser, state.activeUserId]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, JournalEntry[]>();
    [...(activeUser?.entries ?? [])]
      .sort((a, b) => +new Date(b.eatenAt) - +new Date(a.eatenAt))
      .forEach((entry) => {
        const key = formatDay(entry.eatenAt);
        groups.set(key, [...(groups.get(key) ?? []), entry]);
      });
    return [...groups.entries()];
  }, [activeUser]);

  const updateActiveUser = (transform: (user: JournalUser) => JournalUser) => {
    if (!activeUser) return;
    setState((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === activeUser.id ? transform(user) : user)),
    }));
  };

  const saveUser = () => {
    const name = userName.trim();
    if (!name) return;
    if (editingUserId) {
      setState((current) => ({
        ...current,
        users: current.users.map((user) => (user.id === editingUserId ? { ...user, name } : user)),
      }));
      setToast('User name updated');
    } else {
      const user: JournalUser = { id: uid(), name, entries: [] };
      setState((current) => ({ users: [...current.users, user], activeUserId: user.id }));
      setToast(`Welcome, ${name}`);
    }
    setUserName('');
    setEditingUserId(null);
    setShowUserForm(false);
    setShowUserPicker(false);
  };

  const openCreateUser = () => {
    setEditingUserId(null);
    setUserName('');
    setShowUserForm(true);
  };

  const openEditUser = (user: JournalUser) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setShowUserForm(true);
  };

  const confirmDeleteUser = () => {
    if (!deleteUserId) return;
    setState((current) => {
      const users = current.users.filter((user) => user.id !== deleteUserId);
      return { users, activeUserId: users[0]?.id ?? null };
    });
    setDeleteUserId(null);
    setShowUserPicker(false);
    setToast('User deleted from this device');
  };

  const openNewEntry = () => {
    setEditingEntryId(null);
    setDraft(emptyDraft());
    setShowEntry(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    setEditingEntryId(entry.id);
    setDraft({
      description: entry.description,
      image: entry.image,
      eatenAt: entry.eatenAt.slice(0, 16),
      path: entry.path,
      mood: entry.mood,
      place: entry.place,
      after: entry.after,
    });
    setEntryMenuId(null);
    setShowEntry(true);
  };

  const saveEntry = () => {
    if (!draft.description.trim() && !draft.image) {
      setToast('Add a description or photo first');
      return;
    }
    updateActiveUser((user) => {
      if (editingEntryId) {
        return {
          ...user,
          entries: user.entries.map((entry) =>
            entry.id === editingEntryId ? { ...entry, ...draft, description: draft.description.trim() } : entry,
          ),
        };
      }
      return { ...user, entries: [...user.entries, { ...draft, description: draft.description.trim(), id: uid() }] };
    });
    setShowEntry(false);
    setToast(editingEntryId ? 'Entry updated' : 'Added to your journal');
  };

  const confirmDeleteEntry = () => {
    if (!deleteEntryId) return;
    updateActiveUser((user) => ({ ...user, entries: user.entries.filter((entry) => entry.id !== deleteEntryId) }));
    setDeleteEntryId(null);
    setToast('Entry deleted');
  };

  const readImage = (file?: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setToast('Please choose an image smaller than 15 MB');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxEdge = 1400;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(objectUrl);
      setDraft((current) => ({ ...current, image: compressed }));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setToast('That image could not be read');
    };
    image.src = objectUrl;
  };

  if (!hydrated) {
    return <IonApp><div className="launch-screen"><span className="welcome-mark">✦</span><strong>Path</strong></div></IonApp>;
  }

  return (
    <IonApp>
      <IonContent fullscreen className="journal-page">
        <main className="app-shell">
          <header className="topbar">
            <div className="brand" aria-label="Path food journal">
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span>Path</span>
            </div>
            <button className="user-pill" id="user-popover-trigger" onClick={() => setShowUserPicker(true)}>
              <span className="avatar">{activeUser ? initials(activeUser.name) : '?'}</span>
              <span className="user-pill-copy">
                <small>Journal for</small>
                <strong>{activeUser?.name ?? 'Select user'}</strong>
              </span>
              <IonIcon icon={chevronDown} />
            </button>
          </header>

          <section className="journal-heading">
            <div>
              <p className="eyebrow">Your food story</p>
              <h1>{groupedEntries.length ? 'One choice at a time.' : 'Start where you are.'}</h1>
            </div>
            <button className="quiet-menu" aria-label="User options" onClick={() => setShowUserPicker(true)}>
              <IonIcon icon={ellipsisHorizontal} />
            </button>
          </section>

          {!activeUser || activeUser.entries.length === 0 ? (
            <section className="empty-state">
              <div className="empty-preview" aria-hidden="true">
                <img className="preview-one" src="/assets/demo-pie.png" alt="" />
                <img className="preview-two" src="/assets/demo-tacos.png" alt="" />
                <span className="preview-line" />
                <span className="preview-dot" />
              </div>
              <h2>Your timeline is ready</h2>
              <p>Add a meal, a snack, or even just a note. This journal stays on this device.</p>
              <IonButton className="primary-button" onClick={openNewEntry} disabled={!activeUser}>
                <IonIcon icon={add} slot="start" /> Add your first entry
              </IonButton>
            </section>
          ) : (
            <div className="timeline">
              {groupedEntries.map(([day, entries]) => (
                <section className="day-group" key={day}>
                  <div className="day-label"><span>{day}</span><i /></div>
                  {entries.map((entry) => (
                    <article className="entry-row" key={entry.id}>
                      <div className={`rail-dot ${entry.path}`}><IonIcon icon={restaurantOutline} /></div>
                      <div className="entry-time">
                        <strong>{formatTime(entry.eatenAt)}</strong>
                        <span>{entry.path === 'on' ? 'On path' : 'Off path'}</span>
                      </div>
                      <div className="entry-card">
                        {entry.image ? <img src={entry.image} alt={entry.description || 'Food journal entry'} /> : (
                          <div className="text-entry-art"><IonIcon icon={fastFoodOutline} /></div>
                        )}
                        <div className="entry-body">
                          <div className="entry-title-row">
                            <h2>{entry.description || 'Photo entry'}</h2>
                            <button aria-label="Entry actions" id={`entry-${entry.id}`} onClick={() => setEntryMenuId(entry.id)}>
                              <IonIcon icon={ellipsisHorizontal} />
                            </button>
                          </div>
                          <div className="entry-tags">
                            <span>☺ {entry.mood}</span>
                            <span>⌂ {entry.place}</span>
                            <span>♡ {entry.after}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
          <div className="bottom-space" />
        </main>
      </IonContent>

      <nav className="bottom-nav">
        <div className="nav-item active"><IonIcon icon={restaurantOutline} /><span>Journal</span></div>
        <button className="add-button" aria-label="Add journal entry" onClick={openNewEntry} disabled={!activeUser}>
          <IonIcon icon={add} />
        </button>
        <button className="nav-item" onClick={() => setShowUserPicker(true)}>
          <IonIcon icon={personCircleOutline} /><span>Select user</span>
        </button>
      </nav>

      <IonModal isOpen={showEntry} onDidDismiss={() => setShowEntry(false)} breakpoints={[0, 0.96]} initialBreakpoint={0.96}>
        <div className="sheet entry-sheet">
          <div className="sheet-handle" />
          <div className="sheet-header">
            <button onClick={() => setShowEntry(false)} aria-label="Close"><IonIcon icon={close} /></button>
            <div><small>{editingEntryId ? 'Make a change' : 'Remember this moment'}</small><h2>{editingEntryId ? 'Edit entry' : 'What did you eat?'}</h2></div>
            <button className="save-link" onClick={saveEntry}>Save</button>
          </div>
          <div className="sheet-scroll">
            <div className="photo-field" onClick={() => fileInput.current?.click()}>
              {draft.image ? <img src={draft.image} alt="Selected meal" /> : (
                <div><IonIcon icon={cameraOutline} /><strong>Add a photo</strong><span>Choose from your device</span></div>
              )}
              {draft.image && <button className="remove-photo" onClick={(event) => { event.stopPropagation(); setDraft((current) => ({ ...current, image: undefined })); }}><IonIcon icon={close} /></button>}
            </div>
            <input ref={fileInput} hidden type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} />

            <label className="field-label">Description</label>
            <textarea className="description-field" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="e.g. Toast with avocado and eggs" />

            <div className="field-grid">
              <label><span>When</span><input type="datetime-local" value={draft.eatenAt} onChange={(event) => setDraft({ ...draft, eatenAt: event.target.value })} /></label>
            </div>

            <label className="field-label">Was this aligned with your goals?</label>
            <div className="choice-row two">
              <button className={draft.path === 'on' ? 'selected on' : ''} onClick={() => setDraft({ ...draft, path: 'on' })}><IonIcon icon={checkmarkCircle} /> On path</button>
              <button className={draft.path === 'off' ? 'selected off' : ''} onClick={() => setDraft({ ...draft, path: 'off' })}>○ Off path</button>
            </div>

            <ChoiceField title="What mood led to it?" icon="☺" value={draft.mood} values={moods} onChange={(mood) => setDraft({ ...draft, mood })} />
            <ChoiceField title="Where / how did you eat?" icon="⌂" value={draft.place} values={places} onChange={(place) => setDraft({ ...draft, place })} />
            <ChoiceField title="How did you feel after?" icon="♡" value={draft.after} values={afterFeelings} onChange={(after) => setDraft({ ...draft, after })} />
          </div>
        </div>
      </IonModal>

      <IonModal isOpen={showUserPicker} onDidDismiss={() => setShowUserPicker(false)} breakpoints={[0, 0.62]} initialBreakpoint={0.62}>
        <div className="sheet user-sheet">
          <div className="sheet-handle" />
          <div className="user-sheet-heading"><div><small>Local profiles</small><h2>Select user</h2></div><button onClick={openCreateUser}><IonIcon icon={personAddOutline} /> New</button></div>
          <div className="user-list">
            {state.users.map((user) => (
              <div className={`user-row ${user.id === activeUser?.id ? 'active' : ''}`} key={user.id}>
                <button className="user-select" onClick={() => { setState({ ...state, activeUserId: user.id }); setShowUserPicker(false); }}>
                  <span className="avatar large">{initials(user.name)}</span>
                  <span><strong>{user.name}</strong><small>{user.entries.length} {user.entries.length === 1 ? 'entry' : 'entries'} · stored locally</small></span>
                  {user.id === activeUser?.id && <IonIcon className="selected-check" icon={checkmarkCircle} />}
                </button>
                <button className="user-edit" aria-label={`Edit ${user.name}`} onClick={() => openEditUser(user)}><IonIcon icon={createOutline} /></button>
                {state.users.length > 1 && <button className="user-delete" aria-label={`Delete ${user.name}`} onClick={() => setDeleteUserId(user.id)}><IonIcon icon={trashOutline} /></button>}
              </div>
            ))}
          </div>
        </div>
      </IonModal>

      <IonModal isOpen={showUserForm} canDismiss={state.users.length > 0} onDidDismiss={() => state.users.length > 0 && setShowUserForm(false)} className="welcome-modal">
        <div className="welcome-card">
          <span className="welcome-mark">✦</span>
          <p className="eyebrow">Your private food journal</p>
          <h1>{editingUserId ? 'Change user name' : state.users.length ? 'Create another user' : 'Welcome to Path.'}</h1>
          <p>{editingUserId ? 'Entries stay with this profile.' : 'No account, no cloud, no login. Pick a name to begin.'}</p>
          <label><span>User name</span><input autoFocus value={userName} onChange={(event) => setUserName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveUser()} placeholder="e.g. Alex" maxLength={32} /></label>
          <IonButton expand="block" className="primary-button" onClick={saveUser} disabled={!userName.trim()}>{editingUserId ? 'Save name' : 'Create local user'}</IonButton>
          {state.users.length > 0 && <button className="cancel-link" onClick={() => setShowUserForm(false)}>Cancel</button>}
        </div>
      </IonModal>

      <IonActionSheet
        isOpen={Boolean(entryMenuId)}
        onDidDismiss={() => setEntryMenuId(null)}
        header="Entry options"
        buttons={[
          { text: 'Edit entry', icon: createOutline, handler: () => { const entry = activeUser?.entries.find((item) => item.id === entryMenuId); if (entry) openEditEntry(entry); } },
          { text: 'Delete entry', role: 'destructive', icon: trashOutline, handler: () => { setDeleteEntryId(entryMenuId); setEntryMenuId(null); } },
          { text: 'Cancel', role: 'cancel' },
        ]}
      />
      <IonAlert isOpen={Boolean(deleteEntryId)} onDidDismiss={() => setDeleteEntryId(null)} header="Delete this entry?" message="This removes it permanently from this device." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'destructive', handler: confirmDeleteEntry }]} />
      <IonAlert isOpen={Boolean(deleteUserId)} onDidDismiss={() => setDeleteUserId(null)} header="Delete this user?" message="All of this user's journal entries will be permanently removed." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete user', role: 'destructive', handler: confirmDeleteUser }]} />
      <IonToast isOpen={Boolean(toast)} message={toast} duration={1800} position="top" onDidDismiss={() => setToast('')} />
    </IonApp>
  );
}

function ChoiceField({ title, icon, value, values, onChange }: { title: string; icon: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <div className="choice-field">
      <label className="field-label">{title}</label>
      <div className="chip-row">
        {values.map((option) => <button key={option} className={value === option ? 'selected' : ''} onClick={() => onChange(option)}><span>{icon}</span>{option}</button>)}
      </div>
    </div>
  );
}

export default App;
