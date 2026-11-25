import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { PROFESSIONS, professionLabel } from '../api/professions';
import Dropdown from '../components/Dropdown';
import { useAuth } from '../auth';
import type { User, Zone } from '../models';
import { toast } from '../util';

type ZoneTab = '' | 'A' | 'B';

export default function StaffZonesPage() {
  const { user, isAdmin } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [zoneTab, setZoneTab] = useState<ZoneTab>('');
  const [professionFilter, setProfessionFilter] = useState<string>('');
  const [dutyFilter, setDutyFilter] = useState<'' | 'on_duty' | 'off_duty'>('');

  // admin "Add" form
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addZones, setAddZones] = useState<Zone[]>([]);
  const [addProfessions, setAddProfessions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingStaff, setEditingStaff] = useState<{ id: number; name: string; email: string; phone: string; zones: Zone[]; professions: string[] } | null>(null);

  // staff self-edit (professions / zones of their own profile)
  const [myZones, setMyZones] = useState<Zone[]>([]);
  const [myProfessions, setMyProfessions] = useState<string[]>([]);
  const [selfBusy, setSelfBusy] = useState(false);
  const [selfLoaded, setSelfLoaded] = useState(false);

  const refresh = useCallback(() => {
    api
      .listStaff()
      .then((list) => {
        setStaff(list);
        const me = list.find((s) => s.id === user?.id);
        if (me) {
          setMyZones(me.zones);
          setMyProfessions(me.professions);
          setSelfLoaded(true);
        }
      })
      .catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleAddZone = (z: Zone) => {
    setAddZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };
  const toggleAddProf = (p: string) => {
    setAddProfessions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };
  const toggleMyZone = (z: Zone) => {
    setMyZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };
  const toggleMyProf = (p: string) => {
    setMyProfessions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const add = async () => {
    if (!addName.trim() || !addEmail.trim() || !addPhone.trim()) {
      toast('Complete every required field, including phone number.', 'err');
      return;
    }
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(addName.trim())) {
      toast('Enter a valid name using letters, spaces, apostrophes, periods or hyphens.', 'err');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim())) {
      toast('Enter a valid email address containing @ and a domain.', 'err');
      return;
    }
    if (!/^\+?[\d\s()-]{7,20}$/.test(addPhone.trim()) || addPhone.replace(/\D/g, '').length < 7) {
      toast('Enter a valid phone number with at least 7 digits.', 'err');
      return;
    }
    if (!addZones.length || !addProfessions.length) {
      toast('Pick at least one zone and one profession.', 'err');
      return;
    }
    setBusy(true);
    try {
      await api.addStaff({
        name: addName.trim(),
        email: addEmail.trim(),
        phone: addPhone.trim(),
        password: 'password123',
        professions: addProfessions,
        zones: addZones,
      });
      setAddName('');
      setAddEmail('');
      setAddPhone('');
      setAddZones([]);
      setAddProfessions([]);
      refresh();
      toast('Staff added — they cover the selected zone(s) and profession(s).');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add staff.', 'err');
    } finally {
      setBusy(false);
    }
  };

  const saveSelf = async () => {
    if (!user) return;
    if (!myZones.length || !myProfessions.length) {
      toast('Pick at least one zone and one profession.', 'err');
      return;
    }
    setSelfBusy(true);
    try {
      await api.updateStaff(user.id, { professions: myProfessions, zones: myZones });
      refresh();
      toast('Saved — auto-assignment for your zone + profession re-matches immediately.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save.', 'err');
    } finally {
      setSelfBusy(false);
    }
  };

  const saveStaffEdit = async () => {
    if (!editingStaff) return;
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(editingStaff.name.trim())) { toast('Enter a valid name.', 'err'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingStaff.email.trim())) { toast('Enter a valid email address.', 'err'); return; }
    if (!/^\+?[\d\s()-]{7,20}$/.test(editingStaff.phone.trim()) || editingStaff.phone.replace(/\D/g, '').length < 7) { toast('Enter a valid phone number.', 'err'); return; }
    try {
      if (!editingStaff.zones.length || !editingStaff.professions.length) { toast('Select at least one zone and profession.', 'err'); return; }
      await api.updateStaff(editingStaff.id, { name: editingStaff.name.trim(), email: editingStaff.email.trim(), phone: editingStaff.phone.trim(), zones: editingStaff.zones, professions: editingStaff.professions });
      setEditingStaff(null);
      refresh();
      toast('Staff details updated.');
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not update staff.', 'err'); }
  };

  const removeStaff = async (staffId: number) => {
    if (!window.confirm('Delete this staff account? Active tickets will return to the unassigned pool.')) return;
    try {
      await api.deleteStaff(staffId);
      refresh();
      toast('Staff account deleted.');
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not delete staff.', 'err'); }
  };

  const visible = useMemo(() => {
    return staff.filter((s) => {
      if (zoneTab && !s.zones.includes(zoneTab)) return false;
      if (professionFilter && !s.professions.includes(professionFilter)) return false;
      if (dutyFilter && (s.duty_status ?? 'on_duty') !== dutyFilter) return false;
      return true;
    });
  }, [staff, zoneTab, professionFilter, dutyFilter]);

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>{isAdmin ? 'Staff Zones' : 'My Zones'}</h1>
          <p>
            {isAdmin
              ? 'Each staff member covers one or two zones plus a set of professions; tickets auto-assign by zone + category.'
              : 'Tell the system which zone(s) and profession(s) you cover — new tickets in your zone auto-assign to you.'}
          </p>
        </div>
      </div>

      <div className="info-banner">
        <b>How auto-assignment works:</b> a resident picks a zone (A / B) and a category. The system
        matches staff who cover <b>that zone</b> and a <b>profession handling that category</b>{' '}
        (Lighting → Electrician; Garbage → Sanitation / Cleaner; Public Facility → Maintenance /
        Plumber / Gardener / Lift / Pest; Noise → Noise Control / Security). One staff can hold both
        zones and several professions. If nobody matches, the ticket stays unassigned and shows in the
        sidebar <b>Unassigned</b> badge until the admin assigns it manually.
      </div>

      {/* staff self-service: claim the zones/professions they cover */}
      {!isAdmin && selfLoaded && (
        <div className="card">
          <h2>My coverage</h2>
          <div className="field">
            <span className="lbl">Zones I cover (pick one or both)</span>
            <div className="chip-row">
              {(['A', 'B'] as Zone[]).map((z) => (
                <button
                  key={z}
                  type="button"
                  className={`chip${myZones.includes(z) ? ' is-on' : ''}`}
                  onClick={() => toggleMyZone(z)}
                >
                  Zone {z}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="lbl">My professions (multiple allowed)</span>
            <div className="chip-row">
              {PROFESSIONS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className={`chip${myProfessions.includes(p.code) ? ' is-on' : ''}`}
                  onClick={() => toggleMyProf(p.code)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn--primary" disabled={selfBusy} onClick={() => void saveSelf()}>
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
            Save my coverage
          </button>
        </div>
      )}

      {/* admin: add a new staff (zone + professions) */}
      {isAdmin && (
        <div className="card">
          <h2>Add staff</h2>
          <div className="field">
            <span className="lbl">Name <b className="required-star">*</b></span>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Technician Goh"
              required
            />
          </div>
          <div className="field">
            <span className="lbl">Email <b className="required-star">*</b></span>
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="e.g. goh@example.com"
              required
            />
          </div>
          <div className="field">
            <span className="lbl">Phone <b className="required-star">*</b></span>
            <input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="e.g. +6012-3456789" required />
          </div>
          <div className="field">
            <span className="lbl">Zones <b className="required-star">*</b></span>
            <div className="chip-row">
              {(['A', 'B'] as Zone[]).map((z) => (
                <button
                  key={z}
                  type="button"
                  className={`chip${addZones.includes(z) ? ' is-on' : ''}`}
                  onClick={() => toggleAddZone(z)}
                >
                  Zone {z}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="lbl">Professions <b className="required-star">*</b></span>
            <div className="chip-row">
              {PROFESSIONS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className={`chip${addProfessions.includes(p.code) ? ' is-on' : ''}`}
                  onClick={() => toggleAddProf(p.code)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn--primary" disabled={busy} onClick={() => void add()}>
            <i className="fa-solid fa-plus" aria-hidden="true" />
            Add
          </button>
        </div>
      )}

      <div className="card">
        <h2>Zones ({visible.length})</h2>

        {/* sub navbar: Zone A / Zone B + profession filter */}
        <div className="filterbar" style={{ marginBottom: 12 }}>
          <div className="subnav">
            <button
              type="button"
              className={`subnav__btn${zoneTab === '' ? ' is-on' : ''}`}
              onClick={() => setZoneTab('')}
            >
              All
            </button>
            <button
              type="button"
              className={`subnav__btn${zoneTab === 'A' ? ' is-on' : ''}`}
              onClick={() => setZoneTab('A')}
            >
              Zone A
            </button>
            <button
              type="button"
              className={`subnav__btn${zoneTab === 'B' ? ' is-on' : ''}`}
              onClick={() => setZoneTab('B')}
            >
              Zone B
            </button>
          </div>
          <Dropdown
            value={professionFilter}
            onChange={(v) => setProfessionFilter(v)}
            ariaLabel="Filter by profession"
            options={[
              { value: '', label: 'All professions' },
              ...PROFESSIONS.map((p) => ({ value: p.code, label: p.label })),
            ]}
          />
          <Dropdown value={dutyFilter} onChange={(value) => setDutyFilter(value as '' | 'on_duty' | 'off_duty')} ariaLabel="Filter by duty status" options={[{ value: '', label: 'All duty statuses' }, { value: 'on_duty', label: 'On Duty' }, { value: 'off_duty', label: 'Off Duty' }]} />
        </div>

        {visible.length === 0 ? (
          <div className="empty">No staff match this filter.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Zones</th>
                  <th>Professions</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Duty</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} style={{ cursor: 'default' }}>
                    <td className="strong">{editingStaff?.id === s.id ? <input type="text" aria-label="Staff name" value={editingStaff.name} onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })} /> : s.name}</td>
                    <td>
                      {editingStaff?.id === s.id ? <div className="chip-row">{(['A', 'B'] as Zone[]).map((z) => <button key={z} type="button" className={`chip${editingStaff.zones.includes(z) ? ' is-on' : ''}`} onClick={() => setEditingStaff({ ...editingStaff, zones: editingStaff.zones.includes(z) ? editingStaff.zones.filter((zone) => zone !== z) : [...editingStaff.zones, z] })}>Zone {z}</button>)}</div> : s.zones.length ? (
                        s.zones.map((z) => (
                          <span key={z} className="zone-tag">
                            Zone {z}
                          </span>
                        ))
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{editingStaff?.id === s.id ? <div className="chip-row">{PROFESSIONS.map((p) => <button key={p.code} type="button" className={`chip${editingStaff.professions.includes(p.code) ? ' is-on' : ''}`} onClick={() => setEditingStaff({ ...editingStaff, professions: editingStaff.professions.includes(p.code) ? editingStaff.professions.filter((code) => code !== p.code) : [...editingStaff.professions, p.code] })}>{p.label}</button>)}</div> : s.professions.length ? s.professions.map(professionLabel).join(', ') : '—'}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                      {editingStaff?.id === s.id ? <input aria-label="Staff email" type="email" value={editingStaff.email} onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })} /> : s.email}
                    </td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{editingStaff?.id === s.id ? <input aria-label="Staff phone" type="tel" value={editingStaff.phone} onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })} /> : s.phone || '—'}</td>
                    <td><span className={`duty-status${s.duty_status === 'off_duty' ? ' is-off' : ''}`}>{s.duty_status === 'off_duty' ? 'Off Duty' : 'On Duty'}</span></td>
                    {isAdmin && <td style={{ whiteSpace: 'nowrap' }}>{editingStaff?.id === s.id ? <><button className="btn btn--sm btn--primary" onClick={() => void saveStaffEdit()}>Save</button> <button className="btn btn--sm btn--ghost" onClick={() => setEditingStaff(null)}>Cancel</button></> : <><button className="btn btn--sm btn--ghost" onClick={() => setEditingStaff({ id: s.id, name: s.name, email: s.email, phone: s.phone ?? '', zones: [...s.zones], professions: [...s.professions] })}>Edit</button> <button className="btn btn--sm btn--danger" onClick={() => void removeStaff(s.id)}>Delete</button></>}</td>}
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
