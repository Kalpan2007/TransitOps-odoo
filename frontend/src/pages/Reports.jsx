import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Fuel, DollarSign, BarChart3, Navigation } from 'lucide-react';
import { api } from '../api';

const MetricCard = ({ label, value, sub, color = 'var(--accent-color)' }) => (
  <div className="card" style={{ padding: '14px 16px' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
      {label}
    </div>
    <div style={{ fontSize: '24px', fontWeight: '700', fontFamily: 'var(--font-title)', color }}>
      {value ?? '—'}
    </div>
    {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
  </div>
);

// Horizontal bar chart for analytics
const HBarChart = ({ data, valueKey, labelKey, color = 'var(--primary-color)', formatter = v => v }) => {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>No data available.</div>;
  }
  const max = Math.max(...data.map(d => Number(d[valueKey] || 0)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.slice(0, 12).map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            fontSize: '12px', color: 'var(--text-muted)', width: '120px',
            textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {d[labelKey]}
          </div>
          <div style={{ flex: 1, height: '20px', backgroundColor: 'var(--bg-main)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${(Number(d[valueKey] || 0) / max) * 100}%`, height: '100%',
              backgroundColor: color, borderRadius: '2px', minWidth: 2, transition: 'width 0.4s'
            }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: '500', width: '90px', flexShrink: 0 }}>
            {formatter(d[valueKey])}
          </div>
        </div>
      ))}
    </div>
  );
};

const Reports = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [reportTab, setReportTab] = useState('roi');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      const res = await api.getAnalytics(params);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const TABS = [
    ['roi', 'Vehicle ROI'],
    ['fuel', 'Fuel Efficiency'],
    ['costs', 'Operational Costs'],
    ['trips', 'Trip Counts'],
  ];

  const fmt$ = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—';

  // Aggregate totals from vehicleROI
  const vehicleROI = data?.vehicleROI || [];
  const fuelEfficiency = data?.fuelEfficiency || [];
  const operationalCost = data?.operationalCost || [];
  const tripCounts = data?.tripCounts || [];

  const totalRevenue = vehicleROI.reduce((s, v) => s + Number(v.revenue || 0), 0);
  const totalOpCost = vehicleROI.reduce((s, v) => s + Number(v.operationalCost || 0), 0);
  const totalNetProfit = vehicleROI.reduce((s, v) => s + Number(v.netProfit || 0), 0);
  const totalTrips = tripCounts.reduce((s, v) => s + Number(v.tripCount || 0), 0);
  const totalDistance = fuelEfficiency.reduce((s, v) => s + Number(v.totalDistanceKm || 0), 0);
  const totalFuelLiters = fuelEfficiency.reduce((s, v) => s + Number(v.totalFuelLiters || 0), 0);

  return (
    <div>
      {/* Date Filter + Export Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
        padding: '12px 16px', backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)', borderRadius: '2px', flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ margin: 0, fontSize: '12px', whiteSpace: 'nowrap' }}>Date Range:</label>
          <input type="date" value={dateRange.startDate}
            onChange={e => setDateRange(r => ({ ...r, startDate: e.target.value }))} style={{ width: '155px' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>to</span>
          <input type="date" value={dateRange.endDate}
            onChange={e => setDateRange(r => ({ ...r, endDate: e.target.value }))} style={{ width: '155px' }} />
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={14} /> Apply
        </button>
        <div style={{ flex: 1 }} />
        {[
          { type: 'fuel_efficiency', label: 'Fuel CSV', icon: Fuel },
          { type: 'operational_cost', label: 'Cost CSV', icon: DollarSign },
          { type: 'vehicle_roi', label: 'ROI CSV', icon: BarChart3 },
          { type: 'trip_summary', label: 'Trips CSV', icon: Navigation },
        ].map(({ type, label, icon: Icon }) => (
          <button key={type} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => api.exportCsv(type)}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Overview KPI Strip */}
      <div className="grid grid-cols-4" style={{ marginBottom: '16px' }}>
        <MetricCard label="Total Revenue" value={fmt$(totalRevenue)} color="var(--accent-color)" sub="All completed trips" />
        <MetricCard label="Operational Costs" value={fmt$(totalOpCost)} color="var(--error-text)" sub="Fuel + maintenance" />
        <MetricCard label="Net Profit / Loss" value={fmt$(totalNetProfit)}
          color={totalNetProfit >= 0 ? 'var(--success-text)' : 'var(--error-text)'} sub="Revenue minus costs" />
        <MetricCard label="Total Trips" value={totalTrips} color="var(--primary-color)" sub="All time" />
      </div>
      <div className="grid grid-cols-3" style={{ marginBottom: '20px' }}>
        <MetricCard label="Total Distance" value={`${totalDistance.toLocaleString()} km`} color="var(--text-main)" />
        <MetricCard label="Total Fuel Used" value={`${totalFuelLiters.toFixed(0)} L`} color="var(--warning-text)" />
        <MetricCard label="Avg Efficiency" value={totalFuelLiters > 0 ? `${(totalDistance / totalFuelLiters).toFixed(2)} km/L` : '—'} color="var(--neutral-color)" />
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setReportTab(key)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: reportTab === key ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: reportTab === key ? 'var(--accent-color)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: '13px',
            fontWeight: reportTab === key ? '600' : '400', marginBottom: '-1px', transition: 'all 0.2s'
          }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', padding: '32px', textAlign: 'center' }}>Loading analytics…</div>}
      {error && <div style={{ color: 'var(--error-text)', padding: '16px' }}>Error: {error}</div>}

      {data && !loading && (
        <>
          {/* ROI Tab */}
          {reportTab === 'roi' && (
            <div>
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '16px' }}>
                  Vehicle Revenue Ranking
                </h3>
                <HBarChart data={vehicleROI.filter(v => v.revenue > 0)} labelKey="registrationNumber" valueKey="revenue"
                  color="var(--accent-color)" formatter={v => `₹${Number(v||0).toLocaleString('en-IN')}`} />
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Acquisition Cost</th>
                      <th>Revenue</th>
                      <th>Op. Cost</th>
                      <th>Net Profit</th>
                      <th>ROI %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleROI.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data.</td></tr>}
                    {vehicleROI.sort((a, b) => b.revenue - a.revenue).map((v, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: '500', fontFamily: 'monospace', fontSize: '12px' }}>{v.registrationNumber}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.name}</div>
                        </td>
                        <td style={{ fontSize: '12px' }}>{fmt$(v.acquisitionCost)}</td>
                        <td style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{fmt$(v.revenue)}</td>
                        <td style={{ color: 'var(--error-text)', fontSize: '12px' }}>{fmt$(v.operationalCost)}</td>
                        <td style={{ fontWeight: '600', color: Number(v.netProfit) >= 0 ? 'var(--success-text)' : 'var(--error-text)' }}>
                          {fmt$(v.netProfit)}
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: '2px', fontSize: '12px', fontWeight: '600',
                            backgroundColor: Number(v.roiPercentage) >= 0 ? 'var(--success-bg)' : 'var(--error-bg)',
                            color: Number(v.roiPercentage) >= 0 ? 'var(--success-text)' : 'var(--error-text)'
                          }}>
                            {Number(v.roiPercentage || 0).toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fuel Efficiency Tab */}
          {reportTab === 'fuel' && (
            <div>
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '16px' }}>
                  Fleet Fuel Efficiency (km/L)
                </h3>
                <HBarChart
                  data={fuelEfficiency.filter(v => v.efficiencyKmL > 0)}
                  labelKey="registrationNumber" valueKey="efficiencyKmL"
                  color="var(--info-color)" formatter={v => `${Number(v||0).toFixed(2)} km/L`} />
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Total Distance (km)</th>
                      <th>Total Fuel (L)</th>
                      <th>Efficiency (km/L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelEfficiency.sort((a, b) => b.efficiencyKmL - a.efficiencyKmL).map((v, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: '500', fontFamily: 'monospace', fontSize: '12px' }}>{v.registrationNumber}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.name}</div>
                        </td>
                        <td>{Number(v.totalDistanceKm || 0).toLocaleString()} km</td>
                        <td>{Number(v.totalFuelLiters || 0).toFixed(1)} L</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '2px' }}>
                              <div style={{
                                width: `${Math.min((Number(v.efficiencyKmL || 0) / 15) * 100, 100)}%`,
                                height: '100%', backgroundColor: 'var(--info-color)', borderRadius: '2px'
                              }} />
                            </div>
                            <span style={{ fontWeight: '600', fontSize: '12px', minWidth: '50px' }}>
                              {Number(v.efficiencyKmL || 0).toFixed(2)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Costs Tab */}
          {reportTab === 'costs' && (
            <div>
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '16px' }}>
                  Total Operational Cost per Vehicle
                </h3>
                <HBarChart
                  data={operationalCost.filter(v => v.totalOperationalCost > 0)}
                  labelKey="registrationNumber" valueKey="totalOperationalCost"
                  color="var(--error-text)" formatter={v => `₹${Number(v||0).toLocaleString('en-IN')}`} />
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Fuel Cost</th>
                      <th>Maintenance Cost</th>
                      <th>Total Operational Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationalCost.sort((a, b) => b.totalOperationalCost - a.totalOperationalCost).map((v, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: '500', fontFamily: 'monospace', fontSize: '12px' }}>{v.registrationNumber}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.name}</div>
                        </td>
                        <td style={{ color: 'var(--warning-text)' }}>{fmt$(v.fuelCost)}</td>
                        <td style={{ color: 'var(--neutral-color)' }}>{fmt$(v.maintenanceCost)}</td>
                        <td style={{ fontWeight: '600', color: 'var(--error-text)' }}>{fmt$(v.totalOperationalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trip Counts Tab */}
          {reportTab === 'trips' && (
            <div>
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-title)', marginBottom: '16px' }}>
                  Trips per Vehicle
                </h3>
                <HBarChart
                  data={tripCounts.filter(v => v.tripCount > 0)}
                  labelKey="registrationNumber" valueKey="tripCount"
                  color="var(--primary-color)" formatter={v => `${v} trips`} />
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Name</th>
                      <th>Trip Count</th>
                      <th>Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripCounts.sort((a, b) => b.tripCount - a.tripCount).map((v, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '500' }}>{v.registrationNumber}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{v.name}</td>
                        <td style={{ fontWeight: '600', textAlign: 'center' }}>{v.tripCount}</td>
                        <td style={{ width: '200px' }}>
                          <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '2px' }}>
                            <div style={{
                              width: `${Math.min((v.tripCount / Math.max(...tripCounts.map(t => t.tripCount), 1)) * 100, 100)}%`,
                              height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '2px'
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
