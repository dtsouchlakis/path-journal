import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonActionSheet,
  IonAlert,
  IonApp,
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonToast,
} from '@ionic/react';
import {
  add,
  analyticsOutline,
  cameraOutline,
  checkmarkCircle,
  chevronDown,
  close,
  createOutline,
  ellipsisHorizontal,
  fastFoodOutline,
  pauseCircleOutline,
  personAddOutline,
  personCircleOutline,
  restaurantOutline,
  trashOutline,
} from 'ionicons/icons';
import { loadState, saveState } from './storage';

type PathStatus = 'on' | 'off';
type PortionSize = 'Small' | 'Medium' | 'Large';

type JournalEntry = {
  id: string;
  description: string;
  image?: string;
  eatenAt: string;
  path: PathStatus;
  mood: string;
  place: string;
  after: string;
  hungerBefore: number;
  fullnessAfter: number;
  portion: PortionSize;
  hadSeconds: boolean;
  contexts: string[];
  duration: string;
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
const portions: PortionSize[] = ['Small', 'Medium', 'Large'];
const eatingContexts = ['Watching a screen', 'Eating from a package', 'Eating alone', 'Eating with others'];
const mealDurations = ['Under 10 min', '10–20 min', '20+ min'];
const pauseReasons = ['Physically hungry', 'Stressed', 'Bored', 'Tired', 'Thirsty', 'Celebrating'];

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
  hungerBefore: 5,
  fullnessAfter: 7,
  portion: 'Medium',
  hadSeconds: false,
  contexts: [],
  duration: '10–20 min',
});

const normalizeEntry = (entry: JournalEntry): JournalEntry => ({
  ...emptyDraft(),
  ...entry,
  contexts: entry.contexts ?? [],
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

const mostFrequent = (values: string[]) => {
  if (!values.length) return null;
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

function App() {
  const [state, setState] = useState<StoredState>({ activeUserId: null, users: [] });
  const [hydrated, setHydrated] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userName, setUserName] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [entryMenuId, setEntryMenuId] = useState<string | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [pauseReason, setPauseReason] = useState('Physically hungry');
  const [pauseEndsAt, setPauseEndsAt] = useState<number | null>(null);
  const [pauseRemaining, setPauseRemaining] = useState(600);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadState<StoredState>({ activeUserId: null, users: [] }).then((stored) => {
      const normalized = {
        ...stored,
        users: stored.users.map((user) => ({ ...user, entries: user.entries.map(normalizeEntry) })),
      };
      setState(normalized);
      setShowUserForm(stored.users.length === 0);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state).catch(() => setToast('Could not save changes on this device'));
  }, [state, hydrated]);

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

  const weeklyPatterns = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const entries = (activeUser?.entries ?? []).filter((entry) => +new Date(entry.eatenAt) >= cutoff);
    const unplanned = entries.filter((entry) => entry.path === 'off');
    const trigger = mostFrequent(unplanned.map((entry) => entry.mood));
    const context = mostFrequent(unplanned.flatMap((entry) => entry.contexts));
    const averageHunger = entries.length
      ? entries.reduce((sum, entry) => sum + entry.hungerBefore, 0) / entries.length
      : 0;
    const satisfied = entries.filter((entry) => ['Satisfied', 'Energized', 'Comforted'].includes(entry.after)).length;
    const quickMeals = entries.filter((entry) => entry.duration === 'Under 10 min').length;
    return {
      entries,
      unplanned,
      trigger,
      context,
      averageHunger,
      satisfied,
      quickMeals,
    };
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
    setPauseReason('Physically hungry');
    setPauseEndsAt(null);
    setPauseRemaining(600);
    setShowPause(true);
  };

  const continueToNewEntry = () => {
    setEditingEntryId(null);
    setDraft(emptyDraft());
    setShowPause(false);
    setShowEntry(true);
  };

  const startPause = () => {
    setPauseRemaining(600);
    setPauseEndsAt(Date.now() + 10 * 60 * 1000);
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
      hungerBefore: entry.hungerBefore ?? 5,
      fullnessAfter: entry.fullnessAfter ?? 7,
      portion: entry.portion ?? 'Medium',
      hadSeconds: entry.hadSeconds ?? false,
      contexts: entry.contexts ?? [],
      duration: entry.duration ?? '10–20 min',
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

  const pauseSuggestion: Record<string, string> = {
    'Physically hungry': 'A planned, satisfying meal or snack may be exactly what you need.',
    Stressed: 'Try five slow breaths or a short walk, then check whether the urge changed.',
    Bored: 'Change rooms or do one small task before deciding what you want.',
    Tired: 'Rest, tea, or a regular meal may help more than grazing.',
    Thirsty: 'Have a glass of water, then check in with your hunger again.',
    Celebrating: 'Enjoying food is allowed. Decide what would feel satisfying, not restrictive.',
  };

  const formatCountdown = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

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
            <button
              className="quiet-menu"
              aria-label={activeUser?.entries.length ? 'View weekly patterns' : 'User options'}
              onClick={() => activeUser?.entries.length ? setShowPatterns(true) : setShowUserPicker(true)}
            >
              <IonIcon icon={activeUser?.entries.length ? analyticsOutline : ellipsisHorizontal} />
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
            <>
              <button className="pattern-card" onClick={() => setShowPatterns(true)}>
                <span className="pattern-icon"><IonIcon icon={analyticsOutline} /></span>
                <span>
                  <small>This week, on your device</small>
                  <strong>
                    {weeklyPatterns.entries.length} {weeklyPatterns.entries.length === 1 ? 'entry' : 'entries'}
                    {weeklyPatterns.trigger ? ` · ${weeklyPatterns.trigger} is a common trigger` : ' · keep noticing'}
                  </strong>
                </span>
                <span className="pattern-arrow">›</span>
              </button>
              <div className="timeline">
                {groupedEntries.map(([day, entries]) => (
                  <section className="day-group" key={day}>
                    <div className="day-label"><span>{day}</span><i /></div>
                    {entries.map((entry) => (
                      <article className="entry-row" key={entry.id}>
                        <div className={`rail-dot ${entry.path}`}><IonIcon icon={restaurantOutline} /></div>
                        <div className="entry-time">
                          <strong>{formatTime(entry.eatenAt)}</strong>
                          <span>{entry.path === 'on' ? 'Aligned' : 'Unplanned'}</span>
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
                            <div className="entry-reflection">
                              <span><b>{entry.hungerBefore}</b> hunger</span>
                              <i>→</i>
                              <span><b>{entry.fullnessAfter}</b> fullness</span>
                            </div>
                            <div className="entry-tags">
                              <span>{entry.mood}</span>
                              <span>{entry.portion} portion{entry.hadSeconds ? ' + seconds' : ''}</span>
                              <span>{entry.duration}</span>
                              <span>{entry.place}</span>
                              <span>{entry.after}</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            </>
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

            <ScaleField title="How hungry were you before?" low="Not hungry" high="Very hungry" value={draft.hungerBefore} onChange={(hungerBefore) => setDraft({ ...draft, hungerBefore })} />

            <ChoiceField title="Approximate portion" icon="" value={draft.portion} values={portions} onChange={(portion) => setDraft({ ...draft, portion: portion as PortionSize })} />

            <label className="field-label">Did you have another serving?</label>
            <div className="choice-row two">
              <button className={!draft.hadSeconds ? 'selected neutral' : ''} onClick={() => setDraft({ ...draft, hadSeconds: false })}>No seconds</button>
              <button className={draft.hadSeconds ? 'selected neutral' : ''} onClick={() => setDraft({ ...draft, hadSeconds: true })}>Had seconds</button>
            </div>

            <label className="field-label">Did this feel aligned with your intention?</label>
            <div className="choice-row two">
              <button className={draft.path === 'on' ? 'selected on' : ''} onClick={() => setDraft({ ...draft, path: 'on' })}><IonIcon icon={checkmarkCircle} /> Aligned</button>
              <button className={draft.path === 'off' ? 'selected off' : ''} onClick={() => setDraft({ ...draft, path: 'off' })}>Unplanned</button>
            </div>

            <ChoiceField title="What mood led to it?" icon="" value={draft.mood} values={moods} onChange={(mood) => setDraft({ ...draft, mood })} />
            <MultiChoiceField title="What was happening while you ate?" values={eatingContexts} selected={draft.contexts} onChange={(contexts) => setDraft({ ...draft, contexts })} />
            <ChoiceField title="Where / how did you eat?" icon="" value={draft.place} values={places} onChange={(place) => setDraft({ ...draft, place })} />
            <ChoiceField title="Roughly how long did it take?" icon="" value={draft.duration} values={mealDurations} onChange={(duration) => setDraft({ ...draft, duration })} />
            <ChoiceField title="How did you feel after?" icon="" value={draft.after} values={afterFeelings} onChange={(after) => setDraft({ ...draft, after })} />
            <ScaleField title="How full were you afterward?" low="Still hungry" high="Very full" value={draft.fullnessAfter} onChange={(fullnessAfter) => setDraft({ ...draft, fullnessAfter })} />
          </div>
        </div>
      </IonModal>

      <IonModal isOpen={showPause} onDidDismiss={() => { setShowPause(false); setPauseEndsAt(null); }} breakpoints={[0, 0.72]} initialBreakpoint={0.72}>
        <div className="sheet pause-sheet">
          <div className="sheet-handle" />
          <div className="pause-heading">
            <span className="pause-symbol"><IonIcon icon={pauseCircleOutline} /></span>
            <p className="eyebrow">A quick check-in</p>
            <h2>What do you need right now?</h2>
            <p>This is not a test. You can pause, or log your food immediately.</p>
          </div>
          <div className="pause-body">
            <div className="chip-row wrap">
              {pauseReasons.map((reason) => (
                <button key={reason} className={pauseReason === reason ? 'selected' : ''} onClick={() => setPauseReason(reason)}>{reason}</button>
              ))}
            </div>
            <div className="pause-suggestion">{pauseSuggestion[pauseReason]}</div>
            {pauseEndsAt ? (
              <div className="pause-timer">
                <small>Take a breath and check back in</small>
                <strong>{formatCountdown(pauseRemaining)}</strong>
                <button onClick={continueToNewEntry}>Continue now</button>
              </div>
            ) : pauseRemaining === 0 ? (
              <div className="pause-complete">
                <IonIcon icon={checkmarkCircle} />
                <strong>Pause complete</strong>
                <span>Has the urge or hunger changed?</span>
                <IonButton className="primary-button" onClick={continueToNewEntry}>Continue to journal</IonButton>
              </div>
            ) : (
              <div className="pause-actions">
                <IonButton className="primary-button" expand="block" onClick={startPause}>Take a 10-minute pause</IonButton>
                <button onClick={continueToNewEntry}>Log it now</button>
              </div>
            )}
          </div>
        </div>
      </IonModal>

      <IonModal isOpen={showPatterns} onDidDismiss={() => setShowPatterns(false)} breakpoints={[0, 0.78]} initialBreakpoint={0.78}>
        <div className="sheet patterns-sheet">
          <div className="sheet-handle" />
          <div className="patterns-header">
            <span className="pattern-icon large"><IonIcon icon={analyticsOutline} /></span>
            <p className="eyebrow">Last seven days</p>
            <h2>Patterns, not grades.</h2>
            <p>These observations are calculated only from {activeUser?.name}'s local journal.</p>
          </div>
          <div className="insight-list">
            <div className="insight-card">
              <small>Check-ins</small>
              <strong>{weeklyPatterns.entries.length}</strong>
              <p>{weeklyPatterns.unplanned.length} were marked unplanned. That is information—not failure.</p>
            </div>
            <div className="insight-card">
              <small>Average hunger before eating</small>
              <strong>{weeklyPatterns.entries.length ? weeklyPatterns.averageHunger.toFixed(1) : '–'} / 10</strong>
              <p>{weeklyPatterns.averageHunger >= 8 ? 'Very high hunger can make portions harder to judge.' : 'Notice which hunger level leads to a satisfying meal.'}</p>
            </div>
            <div className="insight-card">
              <small>Most common unplanned trigger</small>
              <strong>{weeklyPatterns.trigger ?? 'Not enough data yet'}</strong>
              <p>{weeklyPatterns.context ? `${weeklyPatterns.context} was the most common context.` : 'Keep logging context to reveal a pattern.'}</p>
            </div>
            <div className="insight-card">
              <small>Satisfaction</small>
              <strong>{weeklyPatterns.satisfied} of {weeklyPatterns.entries.length}</strong>
              <p>{weeklyPatterns.quickMeals ? `${weeklyPatterns.quickMeals} quick ${weeklyPatterns.quickMeals === 1 ? 'meal was' : 'meals were'} under 10 minutes.` : 'No meals were marked under 10 minutes.'}</p>
            </div>
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
        {values.map((option) => <button key={option} className={value === option ? 'selected' : ''} onClick={() => onChange(option)}>{icon && <span>{icon}</span>}{option}</button>)}
      </div>
    </div>
  );
}

function MultiChoiceField({ title, values, selected, onChange }: { title: string; values: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };
  return (
    <div className="choice-field">
      <label className="field-label">{title} <small>Select any</small></label>
      <div className="chip-row wrap">
        {values.map((option) => <button key={option} className={selected.includes(option) ? 'selected' : ''} onClick={() => toggle(option)}>{option}</button>)}
      </div>
    </div>
  );
}

function ScaleField({ title, low, high, value, onChange }: { title: string; low: string; high: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="scale-field">
      <div className="scale-heading"><label className="field-label">{title}</label><strong>{value}</strong></div>
      <input aria-label={title} type="range" min="1" max="10" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="scale-labels"><span>1 · {low}</span><span>{high} · 10</span></div>
    </div>
  );
}

export default App;
