import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { IonIcon, IonModal } from '@ionic/react';
import { cameraOutline, checkmarkCircle, close, imageOutline } from 'ionicons/icons';
import type { EntryDraft, PortionSize } from '../../domain/journal';
import { afterFeelings, eatingContexts, mealDurations, moods, places, portions } from '../../domain/journal';
import { StoredImage } from '../shared/StoredImage';
import { chooseNativePhoto, mediaResultToBlob, wasPhotoSelectionCancelled } from './photoService';

type EntryEditorModalProps = {
  isOpen: boolean;
  editing: boolean;
  draft: EntryDraft;
  onDraftChange: (draft: EntryDraft) => void;
  onTakePhoto: () => Promise<void>;
  onPhotoInput: (blob: Blob, name?: string, format?: string) => Promise<void>;
  onRemovePhoto: () => Promise<void>;
  onCancel: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onError: (message: string) => void;
};

export function EntryEditorModal({
  isOpen,
  editing,
  draft,
  onDraftChange,
  onTakePhoto,
  onPhotoInput,
  onRemovePhoto,
  onCancel,
  onSave,
  onDismiss,
  onError,
}: EntryEditorModalProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const processPhoto = async (blob?: Blob, name = '', format = '') => {
    if (!blob) return;
    setProcessingPhoto(true);
    try {
      await onPhotoInput(blob, name, format);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'That photo could not be read');
    } finally {
      setProcessingPhoto(false);
    }
  };

  const takePicture = async () => {
    if (!Capacitor.isNativePlatform()) {
      cameraInput.current?.click();
      return;
    }
    setProcessingPhoto(true);
    try {
      await onTakePhoto();
    } catch (error) {
      if (!wasPhotoSelectionCancelled(error)) onError('The camera could not be opened');
    } finally {
      setProcessingPhoto(false);
    }
  };

  const choosePicture = async () => {
    if (!Capacitor.isNativePlatform()) {
      galleryInput.current?.click();
      return;
    }
    try {
      const selection = await chooseNativePhoto();
      const selected = await mediaResultToBlob(selection.results[0]);
      await processPhoto(selected.blob, '', selected.format);
    } catch (error) {
      if (!wasPhotoSelectionCancelled(error)) onError('The photo picker could not be opened');
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} backdropDismiss={false} className="entry-modal">
      <div className="sheet entry-sheet">
        <div className="sheet-header">
          <button onClick={onCancel} aria-label="Cancel and discard entry"><IonIcon icon={close} /></button>
          <div><small>{editing ? 'Make a change' : 'Remember this moment'}</small><h2>{editing ? 'Edit entry' : 'What did you eat?'}</h2></div>
          <button className="save-link" onClick={onSave}>Save</button>
        </div>
        <div className="sheet-scroll">
          <div className="photo-field">
            {draft.imageId ? <StoredImage imageId={draft.imageId} alt="Selected meal" className="draft-photo" /> : (
              <div><IonIcon icon={cameraOutline} /><strong>Add a photo</strong><span>Take one now or choose from your device</span></div>
            )}
            {processingPhoto && <div className="photo-processing">Preparing photo…</div>}
            {draft.imageId && <button className="remove-photo" onClick={() => { void onRemovePhoto(); }} aria-label="Remove photo"><IonIcon icon={close} /></button>}
          </div>
          <div className="photo-actions">
            <button type="button" onClick={() => { void takePicture(); }} disabled={processingPhoto}><IonIcon icon={cameraOutline} />Take photo</button>
            <button type="button" onClick={() => { void choosePicture(); }} disabled={processingPhoto}><IonIcon icon={imageOutline} />Choose photo</button>
          </div>
          <input ref={cameraInput} hidden type="file" accept="image/*,.heic,.heif,image/heic,image/heif" capture="environment" onChange={(event) => { void processPhoto(event.target.files?.[0], event.target.files?.[0]?.name); event.currentTarget.value = ''; }} />
          <input ref={galleryInput} hidden type="file" accept="image/*,.heic,.heif,image/heic,image/heif" onChange={(event) => { void processPhoto(event.target.files?.[0], event.target.files?.[0]?.name); event.currentTarget.value = ''; }} />

          <label className="field-label">Description</label>
          <textarea className="description-field" rows={3} value={draft.description} onChange={(event) => onDraftChange({ ...draft, description: event.target.value })} placeholder="e.g. Toast with avocado and eggs" />
          <div className="field-grid"><label><span>When</span><input type="datetime-local" value={draft.eatenAt} onChange={(event) => onDraftChange({ ...draft, eatenAt: event.target.value })} /></label></div>
          <ScaleField title="How hungry were you before?" low="Not hungry" high="Very hungry" value={draft.hungerBefore} onChange={(hungerBefore) => onDraftChange({ ...draft, hungerBefore })} />
          <ChoiceField title="Approximate portion" value={draft.portion} values={portions} onChange={(portion) => onDraftChange({ ...draft, portion: portion as PortionSize })} />

          <label className="field-label">Did you have another serving?</label>
          <div className="choice-row two"><button className={!draft.hadSeconds ? 'selected neutral' : ''} onClick={() => onDraftChange({ ...draft, hadSeconds: false })}>No seconds</button><button className={draft.hadSeconds ? 'selected neutral' : ''} onClick={() => onDraftChange({ ...draft, hadSeconds: true })}>Had seconds</button></div>

          <label className="field-label">Did this feel aligned with your intention?</label>
          <div className="choice-row two"><button className={draft.path === 'on' ? 'selected on' : ''} onClick={() => onDraftChange({ ...draft, path: 'on' })}><IonIcon icon={checkmarkCircle} /> Aligned</button><button className={draft.path === 'off' ? 'selected off' : ''} onClick={() => onDraftChange({ ...draft, path: 'off' })}>Unplanned</button></div>

          <ChoiceField title="What mood led to it?" value={draft.mood} values={moods} onChange={(mood) => onDraftChange({ ...draft, mood })} />
          <MultiChoiceField title="What was happening while you ate?" values={eatingContexts} selected={draft.contexts} onChange={(contexts) => onDraftChange({ ...draft, contexts })} />
          <ChoiceField title="Where / how did you eat?" value={draft.place} values={places} onChange={(place) => onDraftChange({ ...draft, place })} />
          <ChoiceField title="Roughly how long did it take?" value={draft.duration} values={mealDurations} onChange={(duration) => onDraftChange({ ...draft, duration })} />
          <ChoiceField title="How did you feel after?" value={draft.after} values={afterFeelings} onChange={(after) => onDraftChange({ ...draft, after })} />
          <ScaleField title="How full were you afterward?" low="Still hungry" high="Very full" value={draft.fullnessAfter} onChange={(fullnessAfter) => onDraftChange({ ...draft, fullnessAfter })} />
        </div>
      </div>
    </IonModal>
  );
}

function ChoiceField({ title, value, values, onChange }: { title: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <div className="choice-field"><label className="field-label">{title}</label><div className="chip-row">{values.map((option) => <button key={option} className={value === option ? 'selected' : ''} onClick={() => onChange(option)}>{option}</button>)}</div></div>;
}

function MultiChoiceField({ title, values, selected, onChange }: { title: string; values: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <div className="choice-field"><label className="field-label">{title}<small>Select any</small></label><div className="chip-row wrap">{values.map((option) => <button key={option} className={selected.includes(option) ? 'selected' : ''} onClick={() => onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])}>{option}</button>)}</div></div>;
}

function ScaleField({ title, low, high, value, onChange }: { title: string; low: string; high: string; value: number; onChange: (value: number) => void }) {
  return <div className="scale-field"><div className="scale-heading"><label className="field-label">{title}</label><strong>{value}</strong></div><input type="range" min="1" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} /><div className="scale-labels"><span>{low}</span><span>{high}</span></div></div>;
}
