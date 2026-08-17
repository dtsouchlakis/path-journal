import { IonIcon, IonModal } from '@ionic/react';
import { analyticsOutline } from 'ionicons/icons';
import type { WeeklyPatterns } from '../../domain/journal';

export function PatternsModal({ isOpen, userName, patterns, onDismiss }: { isOpen: boolean; userName?: string; patterns: WeeklyPatterns; onDismiss: () => void }) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} breakpoints={[0, 0.78]} initialBreakpoint={0.78}>
      <div className="sheet patterns-sheet"><div className="sheet-handle" />
        <div className="patterns-header"><span className="pattern-icon large"><IonIcon icon={analyticsOutline} /></span><p className="eyebrow">Last seven days</p><h2>Patterns, not grades.</h2><p>These observations are calculated only from {userName}'s local journal.</p></div>
        <div className="insight-list">
          <div className="insight-card"><small>Check-ins</small><strong>{patterns.entries.length}</strong><p>{patterns.unplanned.length} were marked unplanned. That is information—not failure.</p></div>
          <div className="insight-card"><small>Average hunger before eating</small><strong>{patterns.entries.length ? patterns.averageHunger.toFixed(1) : '–'} / 10</strong><p>{patterns.averageHunger >= 8 ? 'Very high hunger can make portions harder to judge.' : 'Notice which hunger level leads to a satisfying meal.'}</p></div>
          <div className="insight-card"><small>Most common unplanned trigger</small><strong>{patterns.trigger ?? 'Not enough data yet'}</strong><p>{patterns.context ? `${patterns.context} was the most common context.` : 'Keep logging context to reveal a pattern.'}</p></div>
          <div className="insight-card"><small>Satisfaction</small><strong>{patterns.satisfied} of {patterns.entries.length}</strong><p>{patterns.quickMeals ? `${patterns.quickMeals} quick ${patterns.quickMeals === 1 ? 'meal was' : 'meals were'} under 10 minutes.` : 'No meals were marked under 10 minutes.'}</p></div>
        </div>
      </div>
    </IonModal>
  );
}
