const express = require('express');
const { query } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - Returns real-time KPI aggregates and operational lists
router.get('/', authenticateJWT, async (req, res, next) => {
  const { type, status, region } = req.query;

  try {
    // 1. Core KPIs
    // Base vehicle query with potential filters
    let vehicleFilterText = '1=1';
    const vehicleParams = [];
    let idx = 1;

    if (type) {
      vehicleFilterText += ` AND type = $${idx}`;
      vehicleParams.push(type);
      idx++;
    }
    if (status) {
      vehicleFilterText += ` AND status = $${idx}`;
      vehicleParams.push(status);
      idx++;
    }
    if (region) {
      vehicleFilterText += ` AND region = $${idx}`;
      vehicleParams.push(region);
      idx++;
    }

    // Run queries for active, available, in shop, retired
    const vStatsRes = await query(`
      SELECT status, COUNT(*) as count 
      FROM vehicles 
      WHERE ${vehicleFilterText}
      GROUP BY status
    `, vehicleParams);

    const vehicleCounts = { AVAILABLE: 0, ON_TRIP: 0, IN_SHOP: 0, RETIRED: 0 };
    vStatsRes.rows.forEach(row => {
      vehicleCounts[row.status] = parseInt(row.count) || 0;
    });

    const activeVehicles = vehicleCounts.ON_TRIP;
    const availableVehicles = vehicleCounts.AVAILABLE;
    const vehiclesInMaintenance = vehicleCounts.IN_SHOP;
    const retiredVehicles = vehicleCounts.RETIRED;

    // Calculate Fleet Utilization = (ON_TRIP / Active Non-Retired) * 100
    const activeNonRetiredCount = activeVehicles + availableVehicles + vehiclesInMaintenance;
    const fleetUtilization = activeNonRetiredCount > 0 
      ? Math.round((activeVehicles / activeNonRetiredCount) * 100)
      : 0;

    // Driver availability counts
    const dStatsRes = await query('SELECT status, COUNT(*) as count FROM drivers GROUP BY status');
    const driverCounts = { AVAILABLE: 0, ON_TRIP: 0, OFF_DUTY: 0, SUSPENDED: 0 };
    dStatsRes.rows.forEach(row => {
      driverCounts[row.status] = parseInt(row.count) || 0;
    });

    const driversOnDuty = driverCounts.ON_TRIP;

    // Trip stats
    const tripStatsRes = await query(`
      SELECT status, COUNT(*) as count 
      FROM trips 
      GROUP BY status
    `);
    const tripCounts = { DRAFT: 0, DISPATCHED: 0, COMPLETED: 0, CANCELLED: 0 };
    tripStatsRes.rows.forEach(row => {
      tripCounts[row.status] = parseInt(row.count) || 0;
    });

    // 2. Operational Tables
    // Active Trips table
    const activeTripsRes = await query(`
      SELECT t.id, t.trip_code, t.source, t.destination, t.planned_distance, t.status,
             v.registration_number as vehicle_reg, v.name as vehicle_name,
             d.name as driver_name
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE t.status = 'DISPATCHED'
      ORDER BY t.dispatched_at DESC
    `);

    // Maintenance Attention
    const maintenanceRes = await query(`
      SELECT m.id, m.maintenance_type, m.start_date, m.maintenance_cost,
             v.registration_number as vehicle_reg, v.name as vehicle_name
      FROM maintenance_logs m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.status = 'ACTIVE'
      ORDER BY m.start_date DESC
    `);

    // 3. Dynamic operational activities log
    const activities = [];

    // Get recent trips status events
    const recentTrips = await query(`
      SELECT trip_code, status, updated_at, source, destination
      FROM trips
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    recentTrips.rows.forEach(t => {
      let desc = '';
      if (t.status === 'DRAFT') desc = `Trip ${t.trip_code} created (draft)`;
      else if (t.status === 'DISPATCHED') desc = `Trip ${t.trip_code} dispatched to ${t.destination}`;
      else if (t.status === 'COMPLETED') desc = `Trip ${t.trip_code} completed successfully`;
      else if (t.status === 'CANCELLED') desc = `Trip ${t.trip_code} was cancelled`;

      activities.push({
        message: desc,
        timestamp: t.updated_at
      });
    });

    // Get recent maintenance jobs
    const recentMaint = await query(`
      SELECT m.maintenance_type, m.status, m.updated_at, v.registration_number
      FROM maintenance_logs m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      ORDER BY m.updated_at DESC
      LIMIT 5
    `);
    recentMaint.rows.forEach(m => {
      const state = m.status === 'ACTIVE' ? 'entered maintenance' : 'completed maintenance';
      activities.push({
        message: `Vehicle ${m.registration_number} ${state} (${m.maintenance_type})`,
        timestamp: m.updated_at
      });
    });

    // Get recent fuel logs
    const recentFuel = await query(`
      SELECT f.fuel_quantity_liters, f.created_at, v.registration_number
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      ORDER BY f.created_at DESC
      LIMIT 5
    `);
    recentFuel.rows.forEach(f => {
      activities.push({
        message: `Fuel log added for vehicle ${f.registration_number} (${f.fuel_quantity_liters} Liters)`,
        timestamp: f.created_at
      });
    });

    // Sort combined activities by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentOperationalActivity = activities.slice(0, 15);

    res.json({
      kpis: {
        activeVehicles,
        availableVehicles,
        vehiclesInMaintenance,
        activeTrips: tripCounts.DISPATCHED,
        pendingTrips: tripCounts.DRAFT,
        driversOnDuty,
        fleetUtilization,
      },
      fleetDistribution: {
        available: availableVehicles,
        onTrip: activeVehicles,
        inShop: vehiclesInMaintenance,
        retired: retiredVehicles
      },
      driverAvailability: {
        available: driverCounts.AVAILABLE,
        onTrip: driverCounts.ON_TRIP,
        offDuty: driverCounts.OFF_DUTY,
        suspended: driverCounts.SUSPENDED
      },
      activeTrips: activeTripsRes.rows,
      maintenanceAttention: maintenanceRes.rows,
      recentOperationalActivity,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
