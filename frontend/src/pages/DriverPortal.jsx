import React, { useState, useEffect, useMemo } from 'react';
import { Truck, MapPin, CheckCircle, X, AlertTriangle, RefreshCw, Navigation, Check, Search } from 'lucide-react';
import { api } from '../api';

const STATUS_COLORS = {
  DRAFT:      { bg: 'rgba(113,75,103,0.15)', color: '#A0789B', label: 'Draft' },
  DISPATCHED: { bg: 'rgba(43,108,176,0.15)', color: '#63B3ED', label: 'Active / On Trip' },
  COMPLETED:  { bg: 'rgba(47,133,90,0.15)',  color: '#68D391', label: 'Completed' },
  CANCELLED:  { bg: 'rgba(155,44,44,0.15)',  color: '#FC8181', label: 'Cancelled' },
};

const Modal = ({ title, onClose, children }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 100,
    backgroundColor: 'var(--overlay)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: '8px', width: '520px', maxHeight: '90vh', overflowY: 'auto',
      boxShadow: '0 20px 60px var(--overlay)'
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

const TripCard = ({ trip, onComplete }) => {
  const s = STATUS_COLORS[trip.status] || {};
  const isDispatched = trip.status === 'DISPATCHED';
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: `1px solid ${isDispatched ? 'var(--info-border-strong)' : 'var(--border-color)'}`,
      borderRadius: '8px', padding: '20px', transition: 'all 0.2s',
      boxShadow: isDispatched ? '0 0 0 2px var(--info-shadow)' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>{trip.trip_code}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>
            <MapPin size={13} style={{ color: '#68D391' }} />{trip.source}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>→</span>
            <MapPin size={13} style={{ color: '#FC8181' }} />{trip.destination}
          </div>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px',
          backgroundColor: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>{s.label || trip.status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {[
          { label: 'Vehicle', value: `${trip.vehicle_name || '—'} · ${trip.vehicle_reg || '—'}` },
          { label: 'Cargo', value: `${trip.cargo_weight} kg` },
          { label: 'Planned Distance', value: `${trip.planned_distance} km` },
          ...(trip.fuel_consumed ? [{ label: 'Fuel Used', value: `${trip.fuel_consumed} L` }] : []),
          ...(trip.final_odometer ? [{ label: 'Final Odometer', value: `${trip.final_odometer} km` }] : []),
        ].map((item, i) => (
          <div key={i}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{item.label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '500' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: isDispatched ? '14px' : 0 }}>
        Created: {new Date(trip.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        {trip.dispatched_at && ` · Dispatched: ${new Date(trip.dispatched_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
        {trip.completed_at && ` · Completed: ${new Date(trip.completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
      </div>

      {isDispatched && (
        <button
          onClick={() => onComplete(trip)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 18px', backgroundColor: 'var(--btn-success)', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-family)',
            transition: 'background 0.2s', width: '100%', justifyContent: 'center'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--btn-success-hover)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--btn-success)'}
        >
          <CheckCircle size={15} /> Submit Trip Completion
        </button>
      )}
    </div>
  );
};

const CompleteModal = ({ trip, onClose, onSuccess }) => {
  const [form, setForm] = useState({ final_odometer: '', fuel_consumed: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.completeTrip(trip.id, {
        final_odometer: Number(form.final_odometer),
        fuel_consumed: Number(form.fuel_consumed),
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    color: 'var(--text-main)', fontSize: '13px', fontFamily: 'var(--font-family)', boxSizing: 'border-box'
  };

  return (
    <Modal title={`Complete Trip: ${trip.trip_code}`} onClose={onClose}>
      <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--info-bg-soft)', borderRadius: '6px', border: '1px solid var(--info-border-soft)' }}>
        <div style={{ fontSize: '11px', color: 'var(--info-text)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>TRIP DETAILS</div>
        <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>{trip.source} → {trip.destination} · {trip.planned_distance} km planned</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Vehicle: {trip.vehicle_name} ({trip.vehicle_reg})</div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Final Odometer (km)</label>
          <input style={inputStyle} type="number" min="0" step="0.01" placeholder="e.g. 45800" value={form.final_odometer} onChange={e => setForm(f => ({ ...f, final_odometer: e.target.value }))} required />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Odometer reading at end of trip</div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fuel Consumed (Liters)</label>
          <input style={inputStyle} type="number" min="0" step="0.1" placeholder="e.g. 35.5" value={form.fuel_consumed} onChange={e => setForm(f => ({ ...f, fuel_consumed: e.target.value }))} required />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Total liters used during this trip</div>
        </div>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', color: 'var(--error-text)', fontSize: '13px' }}>
            <AlertTriangle size={14} />{error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--btn-success)', color: '#fff', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-family)', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Submitting...' : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} /> Mark Trip Completed
              </span>
            )}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-family)' }}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

const DriverPortal = ({ user }) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completingTrip, setCompletingTrip] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortConfig] = useState({ key: 'id', direction: 'DESC' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.getMyTrips();
      setTrips(res.trips || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filteredTrips = useMemo(() => {
    let result = trips;
    if (statusFilter) result = result.filter(t => t.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.trip_code?.toLowerCase().includes(q) ||
        t.source?.toLowerCase().includes(q) ||
        t.destination?.toLowerCase().includes(q) ||
        t.vehicle_reg?.toLowerCase().includes(q)
      );
    }
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortConfig.key] ?? '';
        let bVal = b[sortConfig.key] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'ASC' ? aNum - bNum : bNum - aNum;
        }
        return sortConfig.direction === 'ASC'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return result;
  }, [trips, statusFilter, search, sortConfig]);

  const activeTrips = trips.filter(t => t.status === 'DISPATCHED').length;
  const completedTrips = trips.filter(t => t.status === 'COMPLETED').length;

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--info-bg-strong) 0%, var(--primary-bg) 100%)',
        border: '1px solid var(--info-border)', borderRadius: '10px',
        padding: '20px 24px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', gap: '16px'
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: 'var(--info-bg-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Truck size={24} color="#63B3ED" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'var(--font-title)' }}>
            Welcome, {user?.name}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Your assigned trips are shown below. Submit fuel & odometer data after completing a trip.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0' }}>
          {[
            { label: 'Active', value: activeTrips, color: '#63B3ED' },
            { label: 'Done', value: completedTrips, color: '#68D391' },
            { label: 'Total', value: trips.length, color: 'var(--text-muted)' },
          ].map((k, i) => (
            <div key={k.label} style={{ textAlign: 'center', padding: '0 20px', borderLeft: i > 0 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: k.color, fontFamily: 'var(--font-title)' }}>{k.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter + Search + Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['', 'DISPATCHED', 'COMPLETED', 'DRAFT', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', border: '1px solid',
              borderColor: statusFilter === s ? 'var(--accent-color)' : 'var(--border-color)',
              backgroundColor: statusFilter === s ? 'rgba(197,139,50,0.12)' : 'transparent',
              color: statusFilter === s ? 'var(--accent-color)' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font-family)', transition: 'all 0.2s'
            }}>{s || 'All'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search trips…"
              style={{ paddingLeft: '32px', width: '200px' }}
            />
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-family)' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><RefreshCw size={24} style={{ marginBottom: '12px', opacity: 0.5 }} /><div>Loading your trips…</div></div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '8px', padding: '16px 20px', color: 'var(--error-text)', fontSize: '14px' }}>
          <AlertTriangle size={18} />{error}
        </div>
      ) : filteredTrips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', border: '1px dashed var(--border-color)', borderRadius: '10px', color: 'var(--text-muted)' }}>
          <Navigation size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>No trips found</div>
          <div style={{ fontSize: '13px' }}>{statusFilter ? `No ${statusFilter.toLowerCase()} trips.` : 'No trips assigned to you yet. Contact your dispatcher.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredTrips.map(trip => <TripCard key={trip.id} trip={trip} onComplete={setCompletingTrip} />)}
        </div>
      )}

      {completingTrip && <CompleteModal trip={completingTrip} onClose={() => setCompletingTrip(null)} onSuccess={load} />}
    </div>
  );
};

export default DriverPortal;
