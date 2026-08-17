import { IonButton, IonIcon, IonModal } from '@ionic/react';
import { checkmarkCircle, createOutline, personAddOutline, trashOutline } from 'ionicons/icons';
import type { JournalUser } from '../../domain/journal';
import { initials } from '../../domain/journal';

type UserModalsProps = {
  users: JournalUser[];
  activeUserId: string | null;
  pickerOpen: boolean;
  formOpen: boolean;
  editingUserId: string | null;
  userName: string;
  onUserNameChange: (name: string) => void;
  onSelect: (userId: string) => void;
  onCreate: () => void;
  onEdit: (user: JournalUser) => void;
  onDelete: (userId: string) => void;
  onSave: () => void;
  onClosePicker: () => void;
  onCloseForm: () => void;
};

export function UserModals({
  users,
  activeUserId,
  pickerOpen,
  formOpen,
  editingUserId,
  userName,
  onUserNameChange,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onSave,
  onClosePicker,
  onCloseForm,
}: UserModalsProps) {
  return (
    <>
      <IonModal isOpen={pickerOpen} onDidDismiss={onClosePicker} breakpoints={[0, 0.62]} initialBreakpoint={0.62}>
        <div className="sheet user-sheet"><div className="sheet-handle" />
          <div className="user-sheet-heading"><div><small>Local profiles</small><h2>Select user</h2></div><button onClick={onCreate}><IonIcon icon={personAddOutline} /> New</button></div>
          <div className="user-list">{users.map((user) => (
            <div className={`user-row ${user.id === activeUserId ? 'active' : ''}`} key={user.id}>
              <button className="user-select" onClick={() => onSelect(user.id)}><span className="avatar large">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.entries.length} {user.entries.length === 1 ? 'entry' : 'entries'} · stored locally</small></span>{user.id === activeUserId && <IonIcon className="selected-check" icon={checkmarkCircle} />}</button>
              <button className="user-edit" aria-label={`Edit ${user.name}`} onClick={() => onEdit(user)}><IonIcon icon={createOutline} /></button>
              {users.length > 1 && <button className="user-delete" aria-label={`Delete ${user.name}`} onClick={() => onDelete(user.id)}><IonIcon icon={trashOutline} /></button>}
            </div>
          ))}</div>
        </div>
      </IonModal>

      <IonModal isOpen={formOpen} canDismiss={users.length > 0} onDidDismiss={() => users.length > 0 && onCloseForm()} className="welcome-modal">
        <div className="welcome-card">
          <span className="welcome-logo" aria-hidden="true"><i /><b /></span>
          <p className="eyebrow">Your private food journal</p>
          <h1>{editingUserId ? 'Change user name' : users.length ? 'Create another user' : 'Welcome to Daymark.'}</h1>
          <p>{editingUserId ? 'Entries stay with this profile.' : 'No account, no cloud, no login. Pick a name to begin.'}</p>
          <label><span>User name</span><input autoFocus value={userName} onChange={(event) => onUserNameChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSave()} placeholder="e.g. Alex" maxLength={32} /></label>
          <IonButton expand="block" className="primary-button" onClick={onSave} disabled={!userName.trim()}>{editingUserId ? 'Save name' : 'Create local user'}</IonButton>
          {users.length > 0 && <button className="cancel-link" onClick={onCloseForm}>Cancel</button>}
        </div>
      </IonModal>
    </>
  );
}
