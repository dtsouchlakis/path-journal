import { IonButton, IonIcon } from '@ionic/react';
import { add, analyticsOutline, chevronDown, ellipsisHorizontal, fastFoodOutline, restaurantOutline } from 'ionicons/icons';
import type { DailyJournalGroup, JournalEntry, JournalUser } from '../../domain/journal';
import { formatTime, initials } from '../../domain/journal';
import { StoredImage } from '../shared/StoredImage';

type JournalTimelineProps = {
  activeUser: JournalUser | null;
  dayGroups: DailyJournalGroup[];
  weeklyEntryCount: number;
  weeklyTrigger: string | null;
  hasOlderDays: boolean;
  onLoadOlderDays: () => void;
  onAddEntry: () => void;
  onOpenPatterns: () => void;
  onOpenUsers: () => void;
  onOpenEntryMenu: (entry: JournalEntry) => void;
};

export function JournalTimeline({
  activeUser,
  dayGroups,
  weeklyEntryCount,
  weeklyTrigger,
  hasOlderDays,
  onLoadOlderDays,
  onAddEntry,
  onOpenPatterns,
  onOpenUsers,
  onOpenEntryMenu,
}: JournalTimelineProps) {
  const hasEntries = Boolean(activeUser?.entries.length);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Daymark food journal">
          <span className="daymark-logo" aria-hidden="true"><i /><b /></span>
          <span>Daymark</span>
        </div>
        <button className="user-pill" onClick={onOpenUsers}>
          <span className="avatar">{activeUser ? initials(activeUser.name) : '?'}</span>
          <span className="user-pill-copy"><small>Journal for</small><strong>{activeUser?.name ?? 'Select user'}</strong></span>
          <IonIcon icon={chevronDown} />
        </button>
      </header>

      <section className="journal-heading">
        <div><p className="eyebrow">Your daily record</p><h1>{hasEntries ? 'Notice the day clearly.' : 'Begin with today.'}</h1></div>
        <button className="quiet-menu" aria-label={hasEntries ? 'View weekly patterns' : 'User options'} onClick={hasEntries ? onOpenPatterns : onOpenUsers}>
          <IonIcon icon={hasEntries ? analyticsOutline : ellipsisHorizontal} />
        </button>
      </section>

      {!hasEntries ? (
        <section className="empty-state">
          <div className="empty-horizon" aria-hidden="true"><span /><i /></div>
          <h2>Your journal is ready</h2>
          <p>Add a meal, a snack, or a note. Everything remains on this device.</p>
          <IonButton className="primary-button" onClick={onAddEntry} disabled={!activeUser}>
            <IonIcon icon={add} slot="start" /> Add your first entry
          </IonButton>
        </section>
      ) : (
        <>
          <button className="pattern-card" onClick={onOpenPatterns}>
            <span className="pattern-icon"><IonIcon icon={analyticsOutline} /></span>
            <span><small>This week, on your device</small><strong>{weeklyEntryCount} {weeklyEntryCount === 1 ? 'entry' : 'entries'}{weeklyTrigger ? ` · ${weeklyTrigger} is a common trigger` : ' · keep noticing'}</strong></span>
            <span className="pattern-arrow">›</span>
          </button>
          <div className="timeline">
            {hasOlderDays && <button className="load-older-button" onClick={onLoadOlderDays}>Load three older days</button>}
            {dayGroups.map((group) => (
              <section className="day-group" key={group.key}>
                <div className="day-label"><span>{group.label}</span><i /></div>
                {group.entries.map((entry) => (
                  <article className="entry-row" key={entry.id}>
                    <div className={`rail-dot ${entry.path}`}><IonIcon icon={restaurantOutline} /></div>
                    <div className="entry-time"><strong>{formatTime(entry.eatenAt)}</strong><span>{entry.path === 'on' ? 'Aligned' : 'Unplanned'}</span></div>
                    <div className="entry-card">
                      {entry.imageId || entry.image ? (
                        <StoredImage imageId={entry.imageId} legacySource={entry.image} alt={entry.description || 'Food journal entry'} className="entry-photo" deferUntilVisible />
                      ) : <div className="text-entry-art"><IonIcon icon={fastFoodOutline} /></div>}
                      <div className="entry-body">
                        <div className="entry-title-row"><h2>{entry.description || 'Photo entry'}</h2><button aria-label="Entry actions" onClick={() => onOpenEntryMenu(entry)}><IonIcon icon={ellipsisHorizontal} /></button></div>
                        <div className="entry-reflection"><span><b>{entry.hungerBefore}</b> hunger</span><i>→</i><span><b>{entry.fullnessAfter}</b> fullness</span></div>
                        <div className="entry-tags"><span>{entry.mood}</span><span>{entry.portion} portion{entry.hadSeconds ? ' + seconds' : ''}</span><span>{entry.duration}</span><span>{entry.place}</span><span>{entry.after}</span></div>
                      </div>
                    </div>
                  </article>
                ))}
                <footer className="daily-recap">
                  <span className="recap-mark" aria-hidden="true"><i /></span>
                  <span><small>Daily recap</small><strong>{group.alignedPercentage}% aligned</strong><em>{group.alignedCount} of {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'} aligned</em></span>
                </footer>
              </section>
            ))}
          </div>
        </>
      )}
      <div className="bottom-space" />
    </main>
  );
}
