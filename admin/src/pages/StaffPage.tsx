import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { PROFESSIONS, professionLabel } from '../api/professions';
import { useAuth } from '../auth';
import type { User, Zone } from '../models';
import { toast } from '../util';

export default function StaffPage() {
  const { isAdmin } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [professions, setProfessions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api
      .listStaff()
      .then(setStaff)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleZone = (z: Zone) =>
    setZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  const toggleProf = (p: string) =>
    setProfessions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const add = async () => {
    if (!name.trim() || !email.trim()) {
      toast('Name and email are required.', 'err');
      return;
    }
    if (!zones.length || !professions.length) {
      toast('Pick at least one zone and one profession.', 'err');
      return;
    }
    setBusy(true);
    try {
      await api.addStaff({
        name: name.trim(),
        email: email.trim(),
        password: 'password123',
        phone: phone.trim() || undefined,
        professions,
        zones,
      });
      setName('');
      setEmail('');
      setPhone('');
      setZones([]);
      setProfessions([]);
      refresh();
      toast('Staff account created (default password: password123).');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add staff.', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>Staff Management</h1>
          <p>Add maintenance staff and set the zones + professions they cover (admin only).</p>
        </div>
      </div>

      <div className="card">
        <h2>Add a staff account</h2>
        <div className="grid-2">
          <div className="field">
            <span className="lbl">Name *</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Technician Goh" />
          </div>
          <div className="field">
            <span className="lbl">Email *</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. goh@example.com" />
          </div>
        </div>
        <div className="field">
          <span className="lbl">Phone</span>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +6012-3456789" />
        </div>
        <div className="field">
          <span className="lbl">Zones * (a staff can cover both)</span>
          <div className="chip-row">
            {(['A', 'B'] as Zone[]).map((z) => (
              <button key={z} type="button" className={`chip${zones.includes(z) ? ' is-on' : ''}`} onClick={() => toggleZone(z)}>
                Zone {z}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="lbl">Professions * (multiple allowed)</span>
          <div className="chip-row">
            {PROFESSIONS.map((p) => (
              <button
                key={p.code}
                type="button"
                className={`chip${professions.includes(p.code) ? ' is-on' : ''}`}
                onClick={() => toggleProf(p.code)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn--primary" disabled={busy} onClick={() => void add()}>
          <i className="fa-solid fa-user-plus" aria-hidden="true" />
          Add staff
        </button>
      </div>

      <div className="card">
        <h2>Staff ({staff.length})</h2>
        {staff.length === 0 ? (
          <div className="empty">No staff yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Zones</th>
                  <th>Professions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} style={{ cursor: 'default' }}>
                    <td className="strong">{s.name}</td>
                    <td className="mono">{s.email}</td>
                    <td>
                      {s.zones.length
                        ? s.zones.map((z) => (
                            <span key={z} className="zone-tag">
                              Zone {z}
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td>{s.professions.length ? s.professions.map(professionLabel).join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && null /* page is admin-only by route guard */}
    </>
  );
}
