export type PathStatus = 'on' | 'off';
export type PortionSize = 'Small' | 'Medium' | 'Large';

export type JournalEntry = {
  id: string;
  description: string;
  imageId?: string;
  /** Present only until the version 2 database migration stores the image as a Blob. */
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

export type JournalUser = {
  id: string;
  name: string;
  entries: JournalEntry[];
};

export type StoredState = {
  activeUserId: string | null;
  users: JournalUser[];
};

export type EntryDraft = Omit<JournalEntry, 'id' | 'image'>;

export type PendingEntryDraft = {
  userId: string;
  editingEntryId: string | null;
  originalImageId?: string;
  draft: EntryDraft & { image?: string };
};

export type DailyJournalGroup = {
  key: string;
  label: string;
  entries: JournalEntry[];
  alignedCount: number;
  alignedPercentage: number;
};

export type WeeklyPatterns = {
  entries: JournalEntry[];
  unplanned: JournalEntry[];
  trigger: string | null;
  context: string | null;
  averageHunger: number;
  satisfied: number;
  quickMeals: number;
};

export const moods = ['Calm', 'Happy', 'Stressed', 'Bored', 'Sad', 'Celebrating', 'Tired'];
export const places = ['Sitting at a table', 'On the sofa', 'Standing', 'At my desk', 'In the car', 'Out with others'];
export const afterFeelings = ['Satisfied', 'Energized', 'Comforted', 'Still hungry', 'Too full', 'Embarrassed', 'Neutral'];
export const portions: PortionSize[] = ['Small', 'Medium', 'Large'];
export const eatingContexts = ['Watching a screen', 'Eating from a package', 'Eating alone', 'Eating with others'];
export const mealDurations = ['Under 10 min', '10–20 min', '20+ min'];
export const pauseReasons = ['Physically hungry', 'Stressed', 'Bored', 'Tired', 'Thirsty', 'Celebrating'];

export const pauseSuggestion: Record<string, string> = {
  'Physically hungry': 'A planned, satisfying meal or snack may be exactly what you need.',
  Stressed: 'Try five slow breaths or a short walk, then check whether the urge changed.',
  Bored: 'Change rooms or do one small task before deciding what you want.',
  Tired: 'Rest, tea, or a regular meal may help more than grazing.',
  Thirsty: 'Have a glass of water, then check in with your hunger again.',
  Celebrating: 'Enjoying food is allowed. Decide what would feel satisfying, not restrictive.',
};

export const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const nowLocalIso = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

export const createEmptyDraft = (): EntryDraft => ({
  description: '',
  imageId: undefined,
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

export const normalizeEntry = (entry: JournalEntry): JournalEntry => ({
  ...createEmptyDraft(),
  ...entry,
  contexts: entry.contexts ?? [],
});

export const normalizeState = (state: StoredState): StoredState => ({
  ...state,
  users: state.users.map((user) => ({ ...user, entries: user.entries.map(normalizeEntry) })),
});

export const localDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDay = (value: string) => {
  const input = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (input.toDateString() === today.toDateString()) return 'Today';
  if (input.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(input);
};

export const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export const groupEntriesByDay = (entries: JournalEntry[]): DailyJournalGroup[] => {
  const groups = new Map<string, JournalEntry[]>();
  [...entries]
    .sort((left, right) => +new Date(left.eatenAt) - +new Date(right.eatenAt))
    .forEach((entry) => {
      const key = localDateKey(entry.eatenAt);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    });

  return [...groups.entries()].map(([key, dayEntries]) => {
    const alignedCount = dayEntries.filter((entry) => entry.path === 'on').length;
    return {
      key,
      label: formatDay(dayEntries[0].eatenAt),
      entries: dayEntries,
      alignedCount,
      alignedPercentage: Math.round((alignedCount / dayEntries.length) * 100),
    };
  });
};

export const latestDayGroups = (entries: JournalEntry[], dayCount: number) => {
  const groups = groupEntriesByDay(entries);
  return groups.slice(Math.max(0, groups.length - dayCount));
};

export const initials = (name: string) =>
  name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export const mostFrequent = (values: string[]) => {
  if (!values.length) return null;
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
};

export const calculateWeeklyPatterns = (entries: JournalEntry[]): WeeklyPatterns => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentEntries = entries.filter((entry) => +new Date(entry.eatenAt) >= cutoff);
  const unplanned = recentEntries.filter((entry) => entry.path === 'off');
  return {
    entries: recentEntries,
    unplanned,
    trigger: mostFrequent(unplanned.map((entry) => entry.mood)),
    context: mostFrequent(unplanned.flatMap((entry) => entry.contexts)),
    averageHunger: recentEntries.length
      ? recentEntries.reduce((sum, entry) => sum + entry.hungerBefore, 0) / recentEntries.length
      : 0,
    satisfied: recentEntries.filter((entry) => ['Satisfied', 'Energized', 'Comforted'].includes(entry.after)).length,
    quickMeals: recentEntries.filter((entry) => entry.duration === 'Under 10 min').length,
  };
};
