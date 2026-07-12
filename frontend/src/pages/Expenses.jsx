import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../api';

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

const Expenses = ({ userRole }) => {
  const [tab, setTab] = useState('fuel');
  const [fuelLogs, setFuelLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const canManage = userRole === 'FINANCIAL_ANALYST' || userRole === 'ADMIN';

  const [fuelForm, setFuelForm] = useState({
    vehicle_id: '', trip_id: '', fuel_quantity_liters: '', fuel_cost: '', odometer_reading: '', fuel_date: new Date().toISOString().slice(0, 10)
  });
  const [expenseForm, setExpenseForm] = useState({
    vehicle_id: '', trip_id: '', expense_type: 'TOLL', amount: '', description: '', expense_date: new Date().toISOString().slice(0, 10)
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const EXPENSE_CATEGORIES = ['TOLL', 'MAINTENANCE', 'PARKING', 'PERMIT', 'OTHER'];

  const load = async () => {
    setLoading(true);
    try {
      const [fRes, eRes, vRes, tRes] = await Promise.all([
        api.getFuelLogs(), api.getExpenses(), api.getVehicles(), api.getTrips()
      ]);
      setFuelLogs(fRes.fuel_logs || fRes);
      setExpenses(eRes.expenses || eRes);
      setVehicles(vRes.vehicles || vRes);
      setTrips((tRes.trips || tRes).filter(t => t.status !== 'CANCELLED'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalFuelCost = fuelLogs.reduce((s, f) => s + Number(f.fuel_cost || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const handleFuelSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await api.createFuelLog({
        vehicle_id: Number(fuelForm.vehicle_id),
        trip_id: fuelForm.trip_id ? Number(fuelForm.trip_id) : undefined,
        fuel_quantity_liters: Number(fuelForm.fuel_quantity_liters),
        fuel_cost: Number(fuelForm.fuel_cost),
        fuel_date: fuelForm.fuel_date,
        odometer_reading: Number(fuelForm.odometer_reading),
      });
      setShowModal(false);
      setFuelForm({ vehicle_id: '', trip_id: '', fuel_quantity_liters: '', fuel_cost: '', odometer_reading: '', fuel_date: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await api.createExpense({
        vehicle_id: Number(expenseForm.vehicle_id),
        trip_id: expenseForm.trip_id ? Number(expenseForm.trip_id) : undefined,
        expense_type: expenseForm.expense_type,
        amount: Number(expenseForm.amount),
        description: expenseForm.description || undefined,
        expense_date: expenseForm.expense_date,
      });
      setShowModal(false);
      setExpenseForm({ vehicle_id: '', trip_id: '', expense_type: 'TOLL', amount: '', description: '', expense_date: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div>
      {/* KPI Strip */}
      <div className="grid grid-cols-3" style={{ marginBottom: '16px' }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Fuel Cost</div>
          <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'var(--font-title)', color: 'var(--accent-color)' }}>
            ₹{totalFuelCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Operational Expenses</div>
          <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'var(--font-title)', color: 'var(--primary-color)' }}>
            ₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Grand Total</div>
          <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'var(--font-title)' }}>
            ₹{(totalFuelCost + totalExpenses).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
        {[['fuel', 'Fuel Logs'], ['expenses', 'Operational Expenses']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: tab === key ? 'var(--accent-color)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              fontSize: '13px',
              fontWeight: tab === key ? '600' : '400',
              marginBottom: '-1px',
              transition: 'all 0.2s'
            }}
          >
            {label}
          </button>
        ))}
        {canManage && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: '4px' }}>
            <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); }}>
              <Plus size={14} /> Add {tab === 'fuel' ? 'Fuel Log' : 'Expense'}
            </button>
          </div>
        )}
      </div>

      {error && <div style={{ color: 'var(--error-text)', marginBottom: '8px' }}>{error}</div>}

      {/* Fuel Logs Table */}
      {tab === 'fuel' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Log Code</th>
                <th>Vehicle</th>
                <th>Linked Trip</th>
                <th>Quantity</th>
                <th>Total Cost</th>
                <th>Odometer</th>
                <th>Fill Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
              {!loading && fuelLogs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No fuel logs.</td></tr>}
              {fuelLogs.map(f => (
                <tr key={f.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>#FL-{f.id}</td>
                  <td style={{ fontWeight: '500' }}>{f.vehicle_reg} / {f.vehicle_name || `ID: ${f.vehicle_id}`}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{f.trip_id ? `#${f.trip_id}` : '—'}</td>
                  <td>{Number(f.fuel_quantity_liters).toFixed(1)} Liters</td>
                  <td style={{ fontWeight: '600', color: 'var(--accent-color)' }}>
                    ₹{Number(f.fuel_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontSize: '12px' }}>{f.odometer_reading ? `${Number(f.odometer_reading).toLocaleString()} km` : '—'}</td>
                  <td style={{ fontSize: '12px' }}>{f.fuel_date ? new Date(f.fuel_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Operational Expenses Table */}
      {tab === 'expenses' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Expense Code</th>
                <th>Vehicle</th>
                <th>Linked Trip</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
              {!loading && expenses.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No expenses recorded.</td></tr>}
              {expenses.map(e => (
                <tr key={e.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>#EXP-{e.id}</td>
                  <td>{e.vehicle_reg || `ID: ${e.vehicle_id}`}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{e.trip_id ? `#${e.trip_id}` : '—'}</td>
                  <td>
                    <span className="badge badge-inshop">{e.expense_type}</span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{e.description || '—'}</td>
                  <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>
                    ₹{Number(e.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontSize: '12px' }}>{e.expense_date ? new Date(e.expense_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <Modal title={tab === 'fuel' ? 'Record Fuel Refill' : 'Record Operational Expense'} onClose={() => setShowModal(false)}>
          {tab === 'fuel' ? (
            <form onSubmit={handleFuelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid grid-cols-2">
                <div>
                  <label>Vehicle *</label>
                  <select value={fuelForm.vehicle_id} onChange={e => setFuelForm(f => ({ ...f, vehicle_id: e.target.value }))} required>
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
                  </select>
                </div>
                <div>
                  <label>Linked Trip (optional)</label>
                  <select value={fuelForm.trip_id} onChange={e => setFuelForm(f => ({ ...f, trip_id: e.target.value }))}>
                    <option value="">None</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.trip_code} ({t.source}→{t.destination})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2">
                <div>
                  <label>Fuel Date *</label>
                  <input type="date" value={fuelForm.fuel_date} onChange={e => setFuelForm(f => ({ ...f, fuel_date: e.target.value }))} required />
                </div>
                <div>
                  <label>Odometer Reading (km) *</label>
                  <input type="number" value={fuelForm.odometer_reading} onChange={e => setFuelForm(f => ({ ...f, odometer_reading: e.target.value }))} min={0} required />
                </div>
              </div>
              <div className="grid grid-cols-2">
                <div>
                  <label>Quantity (Liters) *</label>
                  <input type="number" value={fuelForm.fuel_quantity_liters} onChange={e => setFuelForm(f => ({ ...f, fuel_quantity_liters: e.target.value }))} min={0} step={0.01} required />
                </div>
                <div>
                  <label>Total Cost (₹) *</label>
                  <input type="number" value={fuelForm.fuel_cost} onChange={e => setFuelForm(f => ({ ...f, fuel_cost: e.target.value }))} min={0} step={0.01} required />
                </div>
              </div>
              {formError && <div style={{ color: 'var(--error-text)', fontSize: '13px' }}>{formError}</div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Log'}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid grid-cols-2">
                <div>
                  <label>Vehicle *</label>
                  <select value={expenseForm.vehicle_id} onChange={e => setExpenseForm(f => ({ ...f, vehicle_id: e.target.value }))} required>
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
                  </select>
                </div>
                <div>
                  <label>Linked Trip (optional)</label>
                  <select value={expenseForm.trip_id} onChange={e => setExpenseForm(f => ({ ...f, trip_id: e.target.value }))}>
                    <option value="">None</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.trip_code}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2">
                <div>
                  <label>Category *</label>
                  <select value={expenseForm.expense_type} onChange={e => setExpenseForm(f => ({ ...f, expense_type: e.target.value }))}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Expense Date *</label>
                  <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label>Amount (₹) *</label>
                <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} min={0} step={0.01} required />
              </div>
              <div>
                <label>Description</label>
                <textarea value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              {formError && <div style={{ color: 'var(--error-text)', fontSize: '13px' }}>{formError}</div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Expense'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Expenses;
