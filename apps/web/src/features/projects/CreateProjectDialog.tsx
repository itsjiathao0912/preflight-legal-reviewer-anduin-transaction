import { useEffect, useId, useState, type FormEvent } from 'react';
import { Icon } from '../../components/ui/icon';
import { Modal } from '../../components/ui/modal';
import {
  MEMBERS_MAX,
  NAME_MAX,
  ROLE_LABEL,
  ROLES,
  useProjects,
  type Role,
} from '../../state/projects';

interface MemberDraft {
  key: number;
  name: string;
  email: string;
  role: Role;
}

let keySeq = 0;
const blankMember = (): MemberDraft => ({ key: ++keySeq, name: '', email: '', role: 'analyst' });

/** Create a project: name (required), description, members (name, email, role). No email is sent. */
export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useProjects((s) => s.create);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([blankMember()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();

  useEffect(() => {
    if (open) return;
    setName('');
    setDescription('');
    setMembers([blankMember()]);
    setError('');
  }, [open]);

  const patch = (key: number, p: Partial<MemberDraft>) =>
    setMembers((list) => list.map((m) => (m.key === key ? { ...m, ...p } : m)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await create({ name, description, members });
      if (!r.ok) return setError(r.message);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description="Members are stored in this browser only. No invitation is sent."
      testId="create-project-dialog"
      className="modal pj-modal"
    >
      <button type="button" className="od-x" aria-label="Close" onClick={() => onOpenChange(false)}>
        <Icon name="x" />
      </button>
      <form
        className="pj-form"
        noValidate
        onSubmit={(e) => void submit(e)}
        aria-label="New project"
      >
        <label className="pj-field" htmlFor={`${id}-name`}>
          <span id={`${id}-name-label`}>Name</span>
          <input
            id={`${id}-name`}
            aria-labelledby={`${id}-name-label`}
            data-testid="project-name-input"
            value={name}
            maxLength={NAME_MAX}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="pj-field" htmlFor={`${id}-desc`}>
          <span id={`${id}-desc-label`}>Description (optional)</span>
          <textarea
            id={`${id}-desc`}
            aria-labelledby={`${id}-desc-label`}
            data-testid="project-description-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <fieldset className="pj-members">
          <legend>Members</legend>
          {members.map((m, i) => (
            <div className="pj-mrow" key={m.key} data-testid="member-row">
              <input
                aria-label={`Member ${i + 1} name`}
                placeholder="Name"
                data-testid="member-name"
                value={m.name}
                onChange={(e) => patch(m.key, { name: e.target.value })}
              />
              <input
                aria-label={`Member ${i + 1} email`}
                placeholder="Email"
                type="email"
                autoComplete="off"
                data-testid="member-email"
                value={m.email}
                onChange={(e) => patch(m.key, { email: e.target.value })}
              />
              <select
                aria-label={`Member ${i + 1} role`}
                data-testid="member-role"
                value={m.role}
                onChange={(e) => patch(m.key, { role: e.target.value as Role })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ibtn"
                aria-label={`Remove member ${i + 1}`}
                data-testid="member-remove"
                onClick={() => setMembers((list) => list.filter((x) => x.key !== m.key))}
              >
                <Icon name="x" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn sm ghost"
            data-testid="member-add"
            disabled={members.length >= MEMBERS_MAX}
            onClick={() => setMembers((list) => [...list, blankMember()])}
          >
            <Icon name="plus" />
            Add member
          </button>
        </fieldset>
        {error ? (
          <p className="pj-error" role="alert" data-testid="create-project-error">
            {error}
          </p>
        ) : null}
        <div className="pj-acts">
          <button type="button" className="btn" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn pri"
            data-testid="create-project-submit"
            disabled={busy}
          >
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
}
