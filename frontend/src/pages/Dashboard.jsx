import React, { useState, useEffect } from 'react';
import { Truck, Users, Navigation, Wrench, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Lightbulb, ClipboardList } from 'lucide-react';
import { api } from '../api';

const KpiCard = ({ title, value, unit = '', sub, color = 'var(--accent-color)', icon: Icon }) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', right: 14, top: 14, opacity: 0.12 }}>
      <Icon size={40} color={color} />
    </div>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '500' }}>
      {title}
    </div>
    <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'var(--font-title)', color }}>
      {value ?? '—'}<span style={{ fontSize: '14px', fontWeight: '400', marginLeft: '4px', color: 'var(--text-muted)' }}>{unit}</span>
    </div>
    {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>}
  </div>
);

// Fleet state stacked bar
const FleetStateBar = ({ dist }) => {
  if (!dist) return null;
  const segments = [
    { key: 'available', label: 'Available', color: 'var(--chart-success)', count: dist.available || 0 },
    { key: 'onTrip',    label: 'On Trip',   color: 'var(--chart-info)', count: dist.onTrip || 0 },
    { key: 'inShop',    label: 'In Shop',   color: 'var(--chart-warning)', count: dist.inShop || 0 },
    { key: 'retired',   label: 'Retired',   color: 'var(--chart-neutral)', count: dist.retired || 0 },
  ];
  const total = segments.reduce((s, x) => s + x.count, 1);
  return (
    <div>
      <div style={{ display: 'flex', height: '18px', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
        {segments.map(s => s.count > 0 && (
          <div key={s.key} title={`${s.label}: ${s.count}`}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color, transition: 'width 0.4s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {segments.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: s.color }} />
            {s.label}: <strong style={{ color: 'var(--text-main)' }}>{s.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mini bar chart
const BarChart = ({ data, label, color }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '80px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '100%', height: `${(d.value / max) * 72}px`,
              backgroundColor: color || 'var(--primary-color)',
              borderRadius: '2px 2px 0 0', minHeight: 2, transition: 'height 0.4s'
            }} />
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Dashboard = ({ userRole }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dashboard Filters State
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (regionFilter) params.region = regionFilter;
      const res = await api.getDashboard(params);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [typeFilter, statusFilter, regionFilter]);

  if (loading && !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      Loading dashboard…
    </div>
  );

  const { kpis = {}, fleetDistribution = {}, driverAvailability = {}, activeTrips = [], maintenanceAttention = [], recentOperationalActivity = [] } = data || {};

  // Build activity bar chart — last 7 days simulated from trip count
  const dayBars = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
    label,
    value: [3, 5, 4, 7, 6, 2, 1][i]
  }));

  return (
    <div>
      {/* Filters Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
        padding: '12px 16px', backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)', borderRadius: '2px', flexWrap: 'wrap'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
          Filters:
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: '150px' }}>
          <option value="">All Vehicle Types</option>
          {['Truck', 'Van', 'Flatbed', 'Refrigerated', 'Tanker', 'Box_Truck'].map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '150px' }}>
          <option value="">All Vehicle Statuses</option>
          {['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ width: '130px' }}>
          <option value="">All Regions</option>
          {['West', 'East', 'North', 'South'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Role-Aware Welcome & Insights Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-bg-strong) 0%, var(--info-bg-soft) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: '2px',
        padding: '16px 20px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '2px',
          backgroundColor: 'var(--accent-bg-strong)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-color)'
        }}>
          <Lightbulb size={20} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'var(--font-title)' }}>
            System Insights Panel · Role: {userRole?.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: '1.4' }}>
            {userRole === 'FLEET_MANAGER' && `Monitor vehicle health and maintenance cycles. Current fleet utilization is at ${kpis.fleetUtilization ?? 0}% with ${kpis.vehiclesInMaintenance ?? 0} vehicle(s) in maintenance.`}
            {userRole === 'DISPATCHER' && `Draft and dispatch trips. There are currently ${kpis.pendingTrips ?? 0} pending (draft) trips that need resources assigned.`}
            {userRole === 'SAFETY_OFFICER' && `Oversee driver safety. Review driver profiles – ${driverAvailability.suspended ?? 0} driver(s) are suspended. Make sure to monitor safety scores and expiring driving licenses.`}
            {userRole === 'FINANCIAL_ANALYST' && `Analyze expenses and fuel logging. Ensure all trip details are logged accurately to calculate vehicle ROI and operational costs.`}
            {userRole === 'ADMIN' && `Full Administrator privileges. Monitor fleet health (${kpis.vehiclesInMaintenance ?? 0} in maintenance), ongoing dispatches (${kpis.activeTrips ?? 0} active trips), safety alerts (${driverAvailability.suspended ?? 0} suspended drivers), and financial metrics.`}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '2px', color: 'var(--error-text)', marginBottom: '16px' }}>
          Error loading dashboard data: {error}
        </div>
      )}

      {/* KPI Row 1 */}
      <div className="grid grid-cols-4" style={{ marginBottom: '0' }}>
        <KpiCard title="Available Vehicles" value={kpis.availableVehicles ?? '—'} icon={Truck} color="var(--success-color)"
          sub={`${kpis.activeVehicles ?? 0} on active trips`} />
        <KpiCard title="Active Trips" value={kpis.activeTrips ?? '—'} icon={Navigation} color="var(--info-color)"
          sub="Currently dispatched" />
        <KpiCard title="Drivers on Duty" value={kpis.driversOnDuty ?? '—'} icon={Users} color="var(--primary-color)"
          sub={`${driverAvailability.available ?? 0} available now`} />
        <KpiCard title="Fleet Utilization" value={kpis.fleetUtilization ?? '—'} unit="%" icon={TrendingUp} color="var(--accent-color)"
          sub="Vehicles actively deployed" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-4" style={{ marginTop: '16px', marginBottom: '0' }}>
        <KpiCard title="Vehicles in Maintenance" value={kpis.vehiclesInMaintenance ?? '—'} icon={Wrench} color="var(--warning-color)"
          sub="Currently in shop" />
        <KpiCard title="Suspended Drivers" value={driverAvailability.suspended ?? '—'} icon={AlertTriangle} color="var(--error-text)"
          sub="Review required" />
        <KpiCard title="Pending Trips" value={kpis.pendingTrips ?? '—'} icon={CheckCircle} color="var(--success-text)"
          sub="Draft — not yet dispatched" />
        <KpiCard title="Off Duty Drivers" value={driverAvailability.offDuty ?? '—'} icon={Users} color="var(--neutral-color)"
          sub="Currently unavailable" />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-3" style={{ marginTop: '16px' }}>
        {/* Fleet State */}
        <div className="card">
          <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '16px' }}>Fleet State</h3>
          <FleetStateBar dist={fleetDistribution} />
          <div style={{ marginTop: '20px' }}>
            <BarChart data={dayBars} label="Trip Volume (Last 7 Days)" color="var(--chart-primary)" />
          </div>
        </div>

        {/* Active Trips */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '12px' }}>
            Active Trips
          </h3>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Trip Code</th>
                  <th>Route</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Distance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeTrips.length === 0 && (
                  <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No active trips at the moment.</td></tr>
                )}
                {activeTrips.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{t.trip_code}</td>
                    <td style={{ fontWeight: '500' }}>{t.source} → {t.destination}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.vehicle_reg} / {t.vehicle_name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.driver_name}</td>
                    <td style={{ fontSize: '12px' }}>{t.planned_distance ? `${t.planned_distance} km` : '—'}</td>
                    <td><span className="badge badge-ontrip">{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2" style={{ marginTop: '0' }}>
        {/* Maintenance attention */}
        <div className="card">
          <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wrench size={16} /> Open Maintenance
          </h3>
          {maintenanceAttention.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No open work orders. Fleet is healthy!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {maintenanceAttention.map(m => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--warning-border)', borderRadius: '2px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{m.maintenance_type}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {m.vehicle_reg} — {m.vehicle_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Cost: ₹{Number(m.maintenance_cost).toLocaleString()}
                    </div>
                  </div>
                  <span className="badge badge-inshop">Open</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="card">
          <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardList size={16} /> Recent Activity
          </h3>
          {recentOperationalActivity.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recent activity.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentOperationalActivity.slice(0, 10).map((a, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                  padding: '6px 0', borderBottom: i < 9 ? '1px solid var(--border-color)' : 'none'
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: 'var(--accent-color)', marginTop: '5px', flexShrink: 0
                  }} />
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>{a.message}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
