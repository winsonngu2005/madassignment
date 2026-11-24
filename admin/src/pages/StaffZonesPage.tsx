import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { addZone, deleteZone, listZones, updateZone } from '../api/zones';
import type { Zone } from '../api/zones';
import type { User } from '../models';
import { toast } from '../util';

interface Draft {
  name: string;
  keywords: string;
  staff_id: number | '';
}

export default function StaffZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [draft, setDraft] = useState<Draft>({ name: '', keywords: '', staff_id: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ name: '', keywords: '', staff_id: '' });

  const refresh = useCallback(() => {
    setZones(listZones());
  }, []);

  useEffect(() => {
    refresh();
    void api.listStaff().then(setStaff).catch(() => undefined);
  }, [refresh]);

  const add = () => {
    if (!draft.name.trim() || !draft.keywords.trim() || !draft.staff_id) {
      toast('Zone name, keywords and a staff owner are all required.', 'err');
      return;
    }
    addZone(draft.name.trim(), draft.keywords.trim(), Number(draft.staff_id));
    refresh();
    setDraft({ name: '', keywords: '', staff_id: '' });
    toast('Zone added — matching tickets in the pool update immediately.');
  };

  const saveEdit = () => {
    if (editId == null) return;
    if (!editDraft.name.trim() || !editDraft.keywords.trim() || !editDraft.staff_id) {
      toast('Zone name, keywords and a staff owner are all required.', 'err');
      return;
    }
    updateZone(editId, {
      name: editDraft.name.trim(),
      keywords: editDraft.keywords.trim(),
      staff_id: Number(editDraft.staff_id),
    });
    setEditId(null);
    refresh();
    toast('Zone updated — the Ticket Pool re-matches on the next load/refresh.');
  };

  const remove = (id: number) => {
    deleteZone(id);
    refresh();
    toast('Zone deleted — its auto-assignments disappear from the pool.');
  };

  const staffName = (id: number) => staff.find((s) => s.id === id)?.name ?? `Staff #${id}`;

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>Staff Zones</h1>
          <p>Each maintenance staff member claims an area; tickets whose location matches get that staff as the suggested assignee.</p>
        </div>
      </div>

      <div className="info-banner">
        <b>How it works:</b> a zone is a set of comma-separated keywords. When a resident&rsquo;s
        location text (e.g. <code>“Block A, Level 3, staircase”</code>) contains any keyword of a zone,
        that zone&rsquo;s staff is auto-suggested as the assignee — the name appears in the Ticket Pool
        and in the Assign dialog pre-selected. Changing a zone&rsquo;s owner immediately re-matches
        every ticket on the next pool refresh (press Refresh or re-open the page). Manually assigned
        tickets always keep their manual assignee. Zones are stored client-side in this build; see
        the hand-off note for the server-side plan.
      </div>

      <div className="card">
        <h2>Add a zone</h2>
        <div className="field">
          <span className="lbl">Zone name *</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Block A area"
          />
        </div>
        <div className="field">
          <span className="lbl">Match keywords (comma-separated) *</span>
          <input
            type="text"
            value={draft.keywords}
            onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
            placeholder="e.g. block a, level 3, staircase"
          />
        </div>
        <div className="field">
          <span className="lbl">Staff owner *</span>
          <select
            value={draft.staff_id}
            onChange={(e) => setDraft({ ...draft, staff_id: e.target.value ? Number(e.target.value) : '' })}
          >
            <option value="">— select staff —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.phone ?? 'no phone'})
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn--primary" onClick={add}>
          <i className="fa-solid fa-plus" aria-hidden="true" />
          Add zone
        </button>
      </div>

      <div className="card">
        <h2>Zones ({zones.length})</h2>
        {zones.length === 0 ? (
          <div className="empty">No zones yet — add one above to enable auto-assignment.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Keywords</th>
                  <th>Staff owner</th>
                  <th style={{ textAlign: 'right' }}>Operations</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} style={{ cursor: 'default' }}>
                    {editId === z.id ? (
                      <>
                        <td>
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editDraft.keywords}
                            onChange={(e) => setEditDraft({ ...editDraft, keywords: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            value={editDraft.staff_id}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                staff_id: e.target.value ? Number(e.target.value) : '',
                              })
                            }
                          >
                            <option value="">— select —</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn--sm btn--primary" onClick={saveEdit}>
                            <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                            Save
                          </button>{' '}
                          <button className="btn btn--sm btn--ghost" onClick={() => setEditId(null)}>
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="strong">{z.name}</td>
                        <td>{z.keywords}</td>
                        <td>{staffName(z.staff_id)}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn--sm btn--ghost"
                            onClick={() => {
                              setEditId(z.id);
                              setEditDraft({
                                name: z.name,
                                keywords: z.keywords,
                                staff_id: z.staff_id,
                              });
                            }}
                          >
                            <i className="fa-solid fa-pen" aria-hidden="true" />
                            Modify
                          </button>{' '}
                          <button className="btn btn--sm btn--danger" onClick={() => remove(z.id)}>
                            <i className="fa-solid fa-trash-can" aria-hidden="true" />
                            Delete
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
