const express = require('express');
const { query } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - Returns role-specific KPIs, charts, and tables
router.get('/', authenticateJWT, async (req, res, next) => {
  const { type, status, region, role } = req.query;

  try {
    // ═══════════════════════════════════════════════════
    // 1. CORE DATA (all roles need this)
    // ═══════════════════════════════════════════════════

    // Vehicle counts by status
    const vStatsRes = await query('SELECT status, COUNT(*) as count FROM vehicles GROUP BY status');
    const vc = { AVAILABLE: 0, ON_TRIP: 0, IN_SHOP: 0, RETIRED: 0 };
    vStatsRes.rows.forEach(r => { vc[r.status] = parseInt(r.count) || 0; });

    const activeNonRetired = vc.AVAILABLE + vc.ON_TRIP + vc.IN_SHOP;
    const fleetUtilization = activeNonRetired > 0 ? Math.round((vc.ON_TRIP / activeNonRetired) * 100) : 0;

    // Driver counts by status
    const dStatsRes = await query('SELECT status, COUNT(*) as count FROM drivers GROUP BY status');
    const dc = { AVAILABLE: 0, ON_TRIP: 0, OFF_DUTY: 0, SUSPENDED: 0 };
    dStatsRes.rows.forEach(r => { dc[r.status] = parseInt(r.count) || 0; });

    // Trip counts by status
    const tStatsRes = await query('SELECT status, COUNT(*) as count FROM trips GROUP BY status');
    const tc = { DRAFT: 0, DISPATCHED: 0, COMPLETED: 0, CANCELLED: 0 };
    tStatsRes.rows.forEach(r => { tc[r.status] = parseInt(r.count) || 0; });

    // Vehicle type distribution
    const vTypeRes = await query('SELECT type, COUNT(*) as count FROM vehicles GROUP BY type ORDER BY count DESC');
    const vehicleTypeDistribution = vTypeRes.rows.map(r => ({ type: r.type, count: parseInt(r.count) }));

    // Total fleet value
    const fleetValueRes = await query('SELECT COALESCE(SUM(acquisition_cost), 0) as total FROM vehicles');
    const totalFleetValue = parseFloat(fleetValueRes.rows[0].total) || 0;

    // Avg odometer
    const avgOdoRes = await query('SELECT COALESCE(AVG(current_odometer), 0) as avg FROM vehicles');
    const avgOdometer = Math.round(parseFloat(avgOdoRes.rows[0].avg) || 0);

    // ═══════════════════════════════════════════════════
    // 2. ROLE-SPECIFIC DATA
    // ═══════════════════════════════════════════════════

    const roleData = {};

    // ─── FLEET MANAGER ──────────────────────────────
    if (role === 'FLEET_MANAGER' || role === 'ADMIN') {
      // Maintenance cost by month (last 6)
      const maintTrend = await query(`
        SELECT TO_CHAR(DATE_TRUNC('month', start_date), 'Mon') as month,
               COALESCE(SUM(maintenance_cost), 0) as cost
        FROM maintenance_logs
        WHERE status = 'COMPLETED' AND start_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', start_date)
        ORDER BY DATE_TRUNC('month', start_date) ASC
      `);

      // Top 5 most expensive vehicles
      const topCostVehicles = await query(`
        SELECT v.registration_number, v.name,
               COALESCE((SELECT SUM(fuel_cost) FROM fuel_logs WHERE vehicle_id = v.id), 0) as fuel_cost,
               COALESCE((SELECT SUM(maintenance_cost) FROM maintenance_logs WHERE vehicle_id = v.id), 0) as maint_cost,
               v.current_odometer, v.status
        FROM vehicles v
        WHERE v.status != 'RETIRED'
        ORDER BY (COALESCE((SELECT SUM(fuel_cost) FROM fuel_logs WHERE vehicle_id = v.id), 0) +
                  COALESCE((SELECT SUM(maintenance_cost) FROM maintenance_logs WHERE vehicle_id = v.id), 0)) DESC
        LIMIT 5
      `);

      // Open maintenance work orders
      const openMaint = await query(`
        SELECT m.id, m.maintenance_type, m.start_date, m.maintenance_cost,
               v.registration_number as vehicle_reg, v.name as vehicle_name
        FROM maintenance_logs m
        LEFT JOIN vehicles v ON m.vehicle_id = v.id
        WHERE m.status = 'ACTIVE'
        ORDER BY m.start_date ASC
      `);

      // Fleet state donut data
      roleData.fleetManager = {
        maintenanceTrend: maintTrend.rows.map(r => ({ label: r.month, value: parseFloat(r.cost) })),
        topCostVehicles: topCostVehicles.rows.map(r => ({
          reg: r.registration_number,
          name: r.name,
          fuelCost: parseFloat(r.fuel_cost),
          maintCost: parseFloat(r.maint_cost),
          totalCost: parseFloat(r.fuel_cost) + parseFloat(r.maint_cost),
          odometer: r.current_odometer,
          status: r.status
        })),
        openMaintenance: openMaint.rows.map(r => ({
          id: r.id,
          type: r.maintenance_type,
          vehicle: r.vehicle_reg,
          vehicleName: r.vehicle_name,
          cost: parseFloat(r.maintenance_cost),
          startDate: r.start_date,
          daysOpen: Math.ceil((new Date() - new Date(r.start_date)) / (1000 * 60 * 60 * 24))
        })),
        fleetState: {
          available: vc.AVAILABLE,
          onTrip: vc.ON_TRIP,
          inShop: vc.IN_SHOP,
          retired: vc.RETIRED
        }
      };
    }

    // ─── DISPATCHER ─────────────────────────────────
    if (role === 'DISPATCHER' || role === 'ADMIN') {
      // Trip status donut
      roleData.dispatcher = {
        tripStatus: {
          draft: tc.DRAFT,
          active: tc.DISPATCHED,
          completed: tc.COMPLETED,
          cancelled: tc.CANCELLED
        },
        // Trips per day (last 7)
        tripsPerDay: [],
        // Pending trips needing dispatch
        pendingTrips: [],
        // Active trips
        activeTrips: []
      };

      // Trips per day (last 7)
      const tripsPerDayRes = await query(`
        SELECT TO_CHAR(DATE(created_at), 'Dy') as day,
               COUNT(*) as count
        FROM trips
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at), TO_CHAR(DATE(created_at), 'Dy')
        ORDER BY DATE(created_at) ASC
      `);
      roleData.dispatcher.tripsPerDay = tripsPerDayRes.rows.map(r => ({
        label: r.day,
        value: parseInt(r.count)
      }));

      // Pending trips
      const pendingRes = await query(`
        SELECT t.id, t.trip_code, t.source, t.destination, t.cargo_weight, t.planned_distance,
               v.registration_number as vehicle_reg, d.name as driver_name
        FROM trips t
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        LEFT JOIN drivers d ON t.driver_id = d.id
        WHERE t.status = 'DRAFT'
        ORDER BY t.created_at ASC
        LIMIT 8
      `);
      roleData.dispatcher.pendingTrips = pendingRes.rows;

      // Active trips
      const activeTripsRes = await query(`
        SELECT t.id, t.trip_code, t.source, t.destination, t.planned_distance, t.cargo_weight,
               v.registration_number as vehicle_reg, v.name as vehicle_name,
               d.name as driver_name
        FROM trips t
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        LEFT JOIN drivers d ON t.driver_id = d.id
        WHERE t.status = 'DISPATCHED'
        ORDER BY t.dispatched_at DESC
        LIMIT 8
      `);
      roleData.dispatcher.activeTrips = activeTripsRes.rows;

      // Dispatch rate
      const totalTrips = tc.DRAFT + tc.DISPATCHED + tc.COMPLETED + tc.CANCELLED;
      roleData.dispatcher.dispatchRate = totalTrips > 0
        ? Math.round(((tc.DISPATCHED + tc.COMPLETED) / totalTrips) * 100) : 0;
      roleData.dispatcher.completionRate = (tc.DISPATCHED + tc.COMPLETED) > 0
        ? Math.round((tc.COMPLETED / (tc.DISPATCHED + tc.COMPLETED)) * 100) : 0;
    }

    // ─── SAFETY OFFICER ─────────────────────────────
    if (role === 'SAFETY_OFFICER' || role === 'ADMIN') {
      // License validity breakdown
      const licenseBreakdown = { valid: 0, expiringSoon: 0, expired: 0 };
      const driversAll = await query('SELECT license_expiry_date, status FROM drivers');
      driversAll.rows.forEach(d => {
        const expiry = new Date(d.license_expiry_date);
        const today = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(today.getDate() + 30);
        if (expiry < today) licenseBreakdown.expired++;
        else if (expiry <= thirtyDays) licenseBreakdown.expiringSoon++;
        else licenseBreakdown.valid++;
      });

      // Safety score distribution
      const scoreDist = { low: 0, medium: 0, good: 0, excellent: 0 };
      driversAll.rows.forEach(d => {
        // We need safety_score, re-query
      });
      const driversWithScores = await query('SELECT safety_score FROM drivers');
      driversWithScores.rows.forEach(d => {
        const score = parseInt(d.safety_score) || 0;
        if (score < 60) scoreDist.low++;
        else if (score < 75) scoreDist.medium++;
        else if (score < 90) scoreDist.good++;
        else scoreDist.excellent++;
      });

      // Expired/expiring licenses
      const licenseAlerts = await query(`
        SELECT name, license_number, license_category, license_expiry_date, safety_score, status
        FROM drivers
        WHERE license_expiry_date <= NOW() + INTERVAL '30 days'
        ORDER BY license_expiry_date ASC
      `);

      // Suspended + low score drivers
      const problemDrivers = await query(`
        SELECT name, license_number, safety_score, status, license_expiry_date
        FROM drivers
        WHERE status = 'SUSPENDED' OR safety_score < 60
        ORDER BY safety_score ASC
      `);

      // Avg safety score
      const avgSafetyRes = await query('SELECT COALESCE(AVG(safety_score), 0) as avg FROM drivers');
      const avgSafetyScore = Math.round(parseFloat(avgSafetyRes.rows[0].avg) || 0);

      roleData.safetyOfficer = {
        licenseBreakdown,
        safetyScoreDistribution: [
          { label: '0-59 (At Risk)', value: scoreDist.low, color: 'var(--error-text)' },
          { label: '60-74 (Fair)', value: scoreDist.medium, color: 'var(--warning-text)' },
          { label: '75-89 (Good)', value: scoreDist.good, color: 'var(--info-text)' },
          { label: '90-100 (Excellent)', value: scoreDist.excellent, color: 'var(--success-text)' }
        ],
        licenseAlerts: licenseAlerts.rows.map(r => ({
          name: r.name,
          licenseNumber: r.license_number,
          category: r.license_category,
          expiryDate: r.license_expiry_date,
          safetyScore: r.safety_score,
          status: r.status
        })),
        problemDrivers: problemDrivers.rows.map(r => ({
          name: r.name,
          licenseNumber: r.license_number,
          safetyScore: r.safety_score,
          status: r.status,
          expiryDate: r.license_expiry_date
        })),
        avgSafetyScore,
        totalDrivers: dc.AVAILABLE + dc.ON_TRIP + dc.OFF_DUTY + dc.SUSPENDED
      };
    }

    // ─── FINANCIAL ANALYST ──────────────────────────
    if (role === 'FINANCIAL_ANALYST' || role === 'ADMIN') {
      // Total fuel cost
      const fuelCostRes = await query('SELECT COALESCE(SUM(fuel_cost), 0) as total FROM fuel_logs');
      const totalFuelCost = parseFloat(fuelCostRes.rows[0].total) || 0;

      // Total maintenance cost
      const maintCostRes = await query('SELECT COALESCE(SUM(maintenance_cost), 0) as total FROM maintenance_logs');
      const totalMaintCost = parseFloat(maintCostRes.rows[0].total) || 0;

      // Total other expenses
      const otherExpRes = await query('SELECT COALESCE(SUM(amount), 0) as total FROM expenses');
      const totalOtherExpenses = parseFloat(otherExpRes.rows[0].total) || 0;

      const totalOperationalCost = totalFuelCost + totalMaintCost + totalOtherExpenses;

      // Total revenue
      const revenueRes = await query("SELECT COALESCE(SUM(revenue), 0) as total FROM trips WHERE status = 'COMPLETED'");
      const totalRevenue = parseFloat(revenueRes.rows[0].total) || 0;
      const netProfit = totalRevenue - totalOperationalCost;

      // Cost breakdown by month (last 6)
      const costByMonth = await query(`
        SELECT TO_CHAR(DATE_TRUNC('month', fuel_date), 'Mon') as month,
               COALESCE(SUM(fuel_cost), 0) as fuel_cost
        FROM fuel_logs
        WHERE fuel_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', fuel_date)
        ORDER BY DATE_TRUNC('month', fuel_date) ASC
      `);

      const maintByMonth = await query(`
        SELECT TO_CHAR(DATE_TRUNC('month', start_date), 'Mon') as month,
               COALESCE(SUM(maintenance_cost), 0) as maint_cost
        FROM maintenance_logs
        WHERE status = 'COMPLETED' AND start_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', start_date)
        ORDER BY DATE_TRUNC('month', start_date) ASC
      `);

      // Merge monthly data
      const monthlyData = {};
      costByMonth.rows.forEach(r => {
        monthlyData[r.month] = { month: r.month, fuel: parseFloat(r.fuel_cost), maintenance: 0, other: 0 };
      });
      maintByMonth.rows.forEach(r => {
        if (!monthlyData[r.month]) monthlyData[r.month] = { month: r.month, fuel: 0, maintenance: 0, other: 0 };
        monthlyData[r.month].maintenance = parseFloat(r.maint_cost);
      });
      const monthlyTrend = Object.values(monthlyData);

      // Vehicle ROI ranking
      const roiRanking = await query(`
        SELECT v.registration_number, v.name, v.acquisition_cost,
               COALESCE((SELECT SUM(revenue) FROM trips WHERE vehicle_id = v.id AND status = 'COMPLETED'), 0) as revenue,
               COALESCE((SELECT SUM(fuel_cost) FROM fuel_logs WHERE vehicle_id = v.id), 0) as fuel_cost,
               COALESCE((SELECT SUM(maintenance_cost) FROM maintenance_logs WHERE vehicle_id = v.id), 0) as maint_cost
        FROM vehicles v
        WHERE v.status != 'RETIRED'
        ORDER BY (COALESCE((SELECT SUM(revenue) FROM trips WHERE vehicle_id = v.id AND status = 'COMPLETED'), 0)) DESC
        LIMIT 6
      `);

      const vehicleROI = roiRanking.rows.map(r => {
        const rev = parseFloat(r.revenue);
        const cost = parseFloat(r.fuel_cost) + parseFloat(r.maint_cost);
        const acqCost = parseFloat(r.acquisition_cost);
        const profit = rev - cost;
        const roi = acqCost > 0 ? ((profit / acqCost) * 100).toFixed(1) : '0.0';
        return {
          reg: r.registration_number,
          name: r.name,
          revenue: rev,
          cost,
          profit,
          roi: parseFloat(roi)
        };
      });

      // Recent expenses
      const recentFuel = await query(`
        SELECT f.id, f.fuel_quantity_liters, f.fuel_cost, f.fuel_date,
               v.registration_number as vehicle_reg
        FROM fuel_logs f
        LEFT JOIN vehicles v ON f.vehicle_id = v.id
        ORDER BY f.fuel_date DESC LIMIT 5
      `);
      const recentExpenses = await query(`
        SELECT e.id, e.expense_type, e.amount, e.expense_date, e.description,
               v.registration_number as vehicle_reg
        FROM expenses e
        LEFT JOIN vehicles v ON e.vehicle_id = v.id
        ORDER BY e.expense_date DESC LIMIT 5
      `);

      const avgROI = vehicleROI.length > 0
        ? (vehicleROI.reduce((s, v) => s + v.roi, 0) / vehicleROI.length).toFixed(1)
        : '0.0';

      roleData.financialAnalyst = {
        totalRevenue,
        totalOperationalCost,
        totalFuelCost,
        totalMaintCost,
        totalOtherExpenses,
        netProfit,
        avgROI: parseFloat(avgROI),
        monthlyTrend,
        costBreakdown: {
          fuel: totalFuelCost,
          maintenance: totalMaintCost,
          other: totalOtherExpenses
        },
        vehicleROI,
        recentActivity: [
          ...recentFuel.rows.map(f => ({
            type: 'fuel',
            vehicle: f.vehicle_reg,
            detail: `${f.fuel_quantity_liters}L`,
            cost: parseFloat(f.fuel_cost),
            date: f.fuel_date
          })),
          ...recentExpenses.rows.map(e => ({
            type: e.expense_type,
            vehicle: e.vehicle_reg,
            detail: e.description || e.expense_type,
            cost: parseFloat(e.amount),
            date: e.expense_date
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
      };
    }

    // ─── ADMIN: merge all ──────────────────────────
    if (role === 'ADMIN') {
      roleData.admin = {
        totalUsers: await query('SELECT COUNT(*) as count FROM users').then(r => parseInt(r.rows[0].count)),
        recentActivity: await query(`
          SELECT trip_code, status, updated_at FROM trips ORDER BY updated_at DESC LIMIT 5
        `).then(r => r.rows.map(t => ({
          message: `Trip ${t.trip_code} → ${t.status}`,
          timestamp: t.updated_at
        })))
      };
    }

    // ═══════════════════════════════════════════════════
    // 3. ASSEMBLE RESPONSE
    // ═══════════════════════════════════════════════════

    res.json({
      kpis: {
        activeVehicles: vc.ON_TRIP,
        availableVehicles: vc.AVAILABLE,
        vehiclesInMaintenance: vc.IN_SHOP,
        retiredVehicles: vc.RETIRED,
        activeTrips: tc.DISPATCHED,
        pendingTrips: tc.DRAFT,
        completedTrips: tc.COMPLETED,
        cancelledTrips: tc.CANCELLED,
        driversOnDuty: dc.ON_TRIP,
        driversAvailable: dc.AVAILABLE,
        driversSuspended: dc.SUSPENDED,
        driversOffDuty: dc.OFF_DUTY,
        fleetUtilization,
        totalFleetValue,
        avgOdometer,
        totalDrivers: dc.AVAILABLE + dc.ON_TRIP + dc.OFF_DUTY + dc.SUSPENDED,
        totalVehicles: vc.AVAILABLE + vc.ON_TRIP + vc.IN_SHOP + vc.RETIRED
      },
      vehicleTypeDistribution,
      roleData
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
