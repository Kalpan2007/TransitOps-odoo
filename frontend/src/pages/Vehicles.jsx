import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Edit2, AlertCircle } from 'lucide-react';
import { api } from '../api';

const STATUS_OPTIONS = ['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED'];
const TYPE_OPTIONS = ['Truck', 'Van', 'Flatbed', 'Refrigerated', 'Tanker', 'Box_Truck'];

const statusClass = (s) => {
  const m = { AVAILABLE: 'available', ON_TRIP: 'ontrip', IN_SHOP: 'inshop', RETIRED: 'retired' };
  return `badge badge-${m[s] || ''}`;
};

const Modal = ({ title, onClose, children }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 100,
    backgroundColor: 'var(--overlay)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: '2px', width: '520px', maxHeight: '90vh', overflowY: 'auto'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid var(--border-color)'
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', fontFamily: 'var(--font-title)' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  </div>
);

const VehicleForm = ({ initial = {}, onSave, onClose }) => {
  const [form, setForm] = useState({
    registration_number: initial.registration_number || '',
    name: initial.name || '',
    model: initial.model || '',
    type: initial.type || 'Truck',
    maximum_load_capacity: initial.maximum_load_capacity || '',
    current_odometer: initial.current_odometer || 0,
    acquisition_cost: initial.acquisition_cost || '',
    region: initial.region || 'West',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave({
        ...form,
        maximum_load_capacity: Number(form.maximum_load_capacity),
        current_odometer: Number(form.current_odometer),
        acquisition_cost: Number(form.acquisition_cost)
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="grid grid-cols-2">
        <div>
          <label>Registration Number *</label>
          <input value={form.registration_number} onChange={e => set('registration_number', e.target.value)} required />
        </div>
        <div>
          <label>Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Heavy Runner" />
        </div>
      </div>
      <div className="grid grid-cols-2">
        <div>
          <label>Make & Model *</label>
          <input value={form.model} onChange={e => set('model', e.target.value)} required placeholder="e.g. Tata Prima" />
        </div>
        <div>
          <label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2">
        <div>
          <label>Acquisition Cost ($) *</label>
          <input type="number" value={form.acquisition_cost} onChange={e => set('acquisition_cost', e.target.value)} required min={1} />
        </div>
        <div>
          <label>Capacity (kg) *</label>
          <input type="number" value={form.maximum_load_capacity} onChange={e => set('maximum_load_capacity', e.target.value)} required min={100} />
        </div>
      </div>
      <div className="grid grid-cols-2">
        <div>
          <label>Region *</label>
          <select value={form.region} onChange={e => set('region', e.target.value)}>
            {['West', 'East', 'North', 'South'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label>Odometer (km)</label>
          <input type="number" value={form.current_odometer} onChange={e => set('current_odometer', e.target.value)} min={0} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--error-text)', fontSize: '13px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Vehicle'}
        </button>
      </div>
    </form>
  );
};

const Vehicles = ({ userRole }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  const canManage = userRole === 'FLEET_MANAGER' || userRole === 'ADMIN';

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.getVehicles(params);
      setVehicles(res.vehicles || res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = vehicles.filter(v =>
    !search || v.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data) => {
    await api.createVehicle(data);
    await load();
  };

  const handleUpdate = async (data) => {
    await api.updateVehicle(editing.id, data);
    setEditing(null);
    await load();
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`Delete vehicle ${v.registration_number}?`)) return;
    try {
      await api.deleteVehicle(v.id);
      setSelected(null);
      await load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  return (
    <div>
      {/* Read-Only Alert for other roles */}
      {!canManage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', backgroundColor: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)', borderRadius: '2px',
          color: 'var(--accent-color)', fontSize: '13px', marginBottom: '16px'
        }}>
          <AlertCircle size={15} />
          <strong>Read-Only View:</strong> Your role ({userRole?.replace(/_/g, ' ')}) has view-only access to the vehicle registry.
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plate, name, model…"
            style={{ paddingLeft: '32px' }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={14} /> Add Vehicle
          </button>
        )}
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-4" style={{ marginBottom: '16px' }}>
        {STATUS_OPTIONS.map(s => (
          <div key={s} className="card" style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{s.replace('_', ' ')}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'var(--font-title)' }}>
              {vehicles.filter(v => v.status === s).length}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Vehicle Table */}
        <div style={{ flex: 1 }}>
          {error && <div style={{ color: 'var(--error-text)', marginBottom: '8px' }}>{error}</div>}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Reg Number</th>
                  <th>Name</th>
                  <th>Model</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Odometer</th>
                  <th>Status</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={canManage ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={canManage ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No vehicles found.</td></tr>
                )}
                {filtered.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => setSelected(v)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontWeight: '600', fontFamily: 'monospace' }}>{v.registration_number}</td>
                    <td>{v.name}</td>
                    <td>{v.model}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{v.type}</td>
                    <td>{Number(v.maximum_load_capacity).toLocaleString()} kg</td>
                    <td>{Number(v.current_odometer || 0).toLocaleString()} km</td>
                    <td><span className={statusClass(v.status)}>{v.status?.replace('_', ' ')}</span></td>
                    {canManage && (
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={e => { e.stopPropagation(); setEditing(v); setShowModal(true); }}
                        >
                          <Edit2 size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ width: '280px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '15px' }}>{selected.registration_number}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 4px', fontSize: '12px' }}>
              {[
                ['Name', selected.name],
                ['Model', selected.model],
                ['Type', selected.type],
                ['Status', selected.status],
                ['Region', selected.region],
                ['Capacity', `${Number(selected.maximum_load_capacity).toLocaleString()} kg`],
                ['Odometer', `${Number(selected.current_odometer || 0).toLocaleString()} km`],
                ['Acquisition', `$${Number(selected.acquisition_cost || 0).toLocaleString()}`],
              ].map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt style={{ color: 'var(--text-muted)' }}>{k}</dt>
                  <dd style={{ color: 'var(--text-main)', fontWeight: '500', textAlign: 'right' }}>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            {canManage && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setEditing(selected); setShowModal(true); }}>
                  <Edit2 size={12} /> Edit Vehicle
                </button>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => handleDelete(selected)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal
          title={editing ? `Edit ${editing.registration_number}` : 'Add New Vehicle'}
          onClose={() => { setShowModal(false); setEditing(null); }}
        >
          <VehicleForm
            initial={editing || {}}
            onSave={editing ? handleUpdate : handleCreate}
            onClose={() => { setShowModal(false); setEditing(null); }}
          />
        </Modal>
      )}
    </div>
  );
};

export default Vehicles;
