import { describe, expect, it } from 'vitest';
import type { JournalEntry } from './journal';
import { groupEntriesByDay, latestDayGroups } from './journal';

const entry = (id: string, eatenAt: string, path: 'on' | 'off'): JournalEntry => ({
  id,
  eatenAt,
  path,
  description: id,
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

describe('journal day grouping', () => {
  it('orders entries by local day and calculates a rounded aligned percentage', () => {
    const groups = groupEntriesByDay([
      entry('late', '2026-08-16T20:00', 'off'),
      entry('early', '2026-08-16T08:00', 'on'),
      entry('middle', '2026-08-16T13:00', 'on'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries.map(({ id }) => id)).toEqual(['early', 'middle', 'late']);
    expect(groups[0].alignedCount).toBe(2);
    expect(groups[0].alignedPercentage).toBe(67);
  });

  it('loads complete calendar days rather than splitting an entry count boundary', () => {
    const entries = [
      entry('day-1', '2026-08-14T12:00', 'on'),
      entry('day-2-a', '2026-08-15T08:00', 'on'),
      entry('day-2-b', '2026-08-15T20:00', 'off'),
      entry('day-3', '2026-08-16T09:00', 'on'),
      entry('day-4', '2026-08-17T09:00', 'on'),
    ];
    const groups = latestDayGroups(entries, 3);
    expect(groups.map(({ key }) => key)).toEqual(['2026-08-15', '2026-08-16', '2026-08-17']);
    expect(groups[0].entries).toHaveLength(2);
  });
});
