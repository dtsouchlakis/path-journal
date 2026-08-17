import { IonButton, IonIcon, IonModal } from '@ionic/react';
import { checkmarkCircle, pauseCircleOutline } from 'ionicons/icons';
import { pauseReasons, pauseSuggestion } from '../../domain/journal';

type PauseModalProps = {
  isOpen: boolean;
  reason: string;
  endsAt: number | null;
  remaining: number;
  onReasonChange: (reason: string) => void;
  onStart: () => void;
  onContinue: () => void;
  onDismiss: () => void;
};

const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function PauseModal({ isOpen, reason, endsAt, remaining, onReasonChange, onStart, onContinue, onDismiss }: PauseModalProps) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} breakpoints={[0, 0.72]} initialBreakpoint={0.72}>
      <div className="sheet pause-sheet"><div className="sheet-handle" />
        <div className="pause-heading"><span className="pause-symbol"><IonIcon icon={pauseCircleOutline} /></span><p className="eyebrow">A quick check-in</p><h2>What do you need right now?</h2><p>This is not a test. You can pause, or log your food immediately.</p></div>
        <div className="pause-body">
          <div className="chip-row wrap">{pauseReasons.map((option) => <button key={option} className={reason === option ? 'selected' : ''} onClick={() => onReasonChange(option)}>{option}</button>)}</div>
          <div className="pause-suggestion">{pauseSuggestion[reason]}</div>
          {endsAt ? <div className="pause-timer"><small>Take a breath and check back in</small><strong>{formatCountdown(remaining)}</strong><button onClick={onContinue}>Continue now</button></div>
            : remaining === 0 ? <div className="pause-complete"><IonIcon icon={checkmarkCircle} /><strong>Pause complete</strong><span>Has the urge or hunger changed?</span><IonButton className="primary-button" onClick={onContinue}>Continue to journal</IonButton></div>
              : <div className="pause-actions"><IonButton className="primary-button" expand="block" onClick={onStart}>Take a 10-minute pause</IonButton><button onClick={onContinue}>Log it now</button></div>}
        </div>
      </div>
    </IonModal>
  );
}
