const express = require('express');
const { query } = require('../config/database');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/vehicles - List vehicles with search and filtering
router.get('/', authenticateJWT, async (req, res, next) => {
  const { type, status, region, search, sort, order } = req.query;

  let queryText = 'SELECT * FROM vehicles WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;

  if (type) {
    queryText += ` AND type = $${paramIndex}`;
    queryParams.push(type);
    paramIndex++;
  }

  if (status) {
    queryText += ` AND status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  if (region) {
    queryText += ` AND region = $${paramIndex}`;
    queryParams.push(region);
    paramIndex++;
  }

  if (search) {
    queryText += ` AND (registration_number ILIKE $${paramIndex} OR name ILIKE $${paramIndex} OR model ILIKE $${paramIndex})`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const allowedSort = { id: 'id', registration_number: 'registration_number', name: 'name', model: 'model', type: 'type', maximum_load_capacity: 'maximum_load_capacity', current_odometer: 'current_odometer', status: 'status' };
  const sortCol = allowedSort[sort] || 'id';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
  queryText += ` ORDER BY ${sortCol} ${sortOrder}`;

  try {
    const result = await query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/vehicles/:id - Vehicle Details & Metrics Summary
router.get('/:id', authenticateJWT, async (req, res, next) => {
  const vehicleId = parseInt(req.params.id);

  try {
    const vehicleRes = await query('SELECT * FROM vehicles WHERE id = $1', [vehicleId]);
    if (vehicleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }
    const vehicle = vehicleRes.rows[0];

    // Calculate metrics:
    // 1. Trips count & Distance
    // Note: completed trips have distance = final_odometer - start_odometer
    // Wait, let's look at the database. In the table `trips`, the distance traveled is not explicitly stored,
    // but the planned distance is `planned_distance`. However, completing a trip updates `final_odometer`.
    // Wait! Let's check: "Calculate actual distance if applicable."
    // Let's compute actual distance for completed trips: final_odometer - start_odometer (start_odometer is not in trip table directly, but wait! We can compute it if we want, or use planned_distance, or since we store completed trips, we can sum the calculated distance: final_odometer - start_odometer, where start_odometer would be the vehicle's odometer prior to completion. Let's make sure our metrics are consistent.
    // Wait, let's write a query to compute total distance. Since trips completed have `planned_distance` or we can use `planned_distance` as the distance traveled, let's sum `planned_distance` for completed trips, or if we want to be more exact, we can use `planned_distance` as distance. In README.md: "Fuel Efficiency = Distance Travelled / Fuel Consumed. Example: Distance = 500 KM, Fuel = 50 Liters, Fuel Efficiency = 10 KM/L."
    // Let's compute total distance from completed trips planned_distance.
    const tripsRes = await query(
      'SELECT COUNT(*) as count, SUM(planned_distance) as total_distance FROM trips WHERE vehicle_id = $1 AND status = \'COMPLETED\'',
      [vehicleId]
    );
    const totalTripsCount = parseInt(tripsRes.rows[0].count) || 0;
    const totalDistance = parseFloat(tripsRes.rows[0].total_distance) || 0.0;

    // 2. Fuel Metrics
    const fuelRes = await query(
      'SELECT SUM(fuel_quantity_liters) as total_fuel, SUM(fuel_cost) as total_fuel_cost FROM fuel_logs WHERE vehicle_id = $1',
      [vehicleId]
    );
    const totalFuelUsed = parseFloat(fuelRes.rows[0].total_fuel) || 0.0;
    const totalFuelCost = parseFloat(fuelRes.rows[0].total_fuel_cost) || 0.0;

    // 3. Maintenance Cost
    const maintRes = await query(
      'SELECT SUM(maintenance_cost) as total_maint_cost FROM maintenance_logs WHERE vehicle_id = $1',
      [vehicleId]
    );
    const totalMaintCost = parseFloat(maintRes.rows[0].total_maint_cost) || 0.0;

    // 4. Expenses
    const expenseRes = await query(
      'SELECT SUM(amount) as total_expense FROM expenses WHERE vehicle_id = $1',
      [vehicleId]
    );
    const totalExpenses = parseFloat(expenseRes.rows[0].total_expense) || 0.0;

    // Total operational cost = fuel + maintenance
    const totalOperationalCost = totalFuelCost + totalMaintCost;

    // History logs
    const historyTrips = await query('SELECT * FROM trips WHERE vehicle_id = $1 ORDER BY id DESC LIMIT 5', [vehicleId]);
    const historyMaintenance = await query('SELECT * FROM maintenance_logs WHERE vehicle_id = $1 ORDER BY id DESC LIMIT 5', [vehicleId]);
    const historyFuel = await query('SELECT * FROM fuel_logs WHERE vehicle_id = $1 ORDER BY id DESC LIMIT 5', [vehicleId]);
    const historyExpenses = await query('SELECT * FROM expenses WHERE vehicle_id = $1 ORDER BY id DESC LIMIT 5', [vehicleId]);

    res.json({
      vehicle,
      summary: {
        totalTrips: totalTripsCount,
        totalDistance,
        totalFuelUsed,
        totalFuelCost,
        totalMaintenanceCost: totalMaintCost,
        totalOperationalCost,
        totalExpenses,
      },
      history: {
        trips: historyTrips.rows,
        maintenance: historyMaintenance.rows,
        fuelLogs: historyFuel.rows,
        expenses: historyExpenses.rows,
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vehicles - Create vehicle (FLEET_MANAGER only)
router.post('/', authenticateJWT, authorizeRoles('FLEET_MANAGER'), async (req, res, next) => {
  const { registration_number, name, model, type, maximum_load_capacity, current_odometer, acquisition_cost, region } = req.body;

  if (!registration_number || !name || !model || !type || !maximum_load_capacity || current_odometer === undefined || !acquisition_cost || !region) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Check registration_number uniqueness
    const exists = await query('SELECT id FROM vehicles WHERE registration_number = $1', [registration_number]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Vehicle Registration Number must be unique.' });
    }

    const insertQuery = `
      INSERT INTO vehicles (registration_number, name, model, type, maximum_load_capacity, current_odometer, acquisition_cost, region, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AVAILABLE')
      RETURNING *
    `;
    const result = await query(insertQuery, [
      registration_number, name, model, type, maximum_load_capacity, current_odometer, acquisition_cost, region
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/vehicles/:id - Update vehicle (FLEET_MANAGER only)
router.put('/:id', authenticateJWT, authorizeRoles('FLEET_MANAGER'), async (req, res, next) => {
  const vehicleId = parseInt(req.params.id);
  const { registration_number, name, model, type, maximum_load_capacity, current_odometer, acquisition_cost, region, status } = req.body;

  try {
    // Check vehicle exists
    const exists = await query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    // Check uniqueness of registration_number if changed
    if (registration_number) {
      const regExists = await query('SELECT id FROM vehicles WHERE registration_number = $1 AND id <> $2', [registration_number, vehicleId]);
      if (regExists.rows.length > 0) {
        return res.status(400).json({ error: 'Vehicle Registration Number must be unique.' });
      }
    }

    // Dynamic update
    const fields = { registration_number, name, model, type, maximum_load_capacity, current_odometer, acquisition_cost, region, status };
    const queryParts = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        queryParts.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (queryParts.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(vehicleId);
    const updateQuery = `
      UPDATE vehicles
      SET ${queryParts.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vehicles/:id - Delete vehicle (FLEET_MANAGER only)
router.delete('/:id', authenticateJWT, authorizeRoles('FLEET_MANAGER'), async (req, res, next) => {
  const vehicleId = parseInt(req.params.id);

  try {
    const exists = await query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    // Prevent deleting vehicle if referenced by a trip
    const refTrips = await query('SELECT id FROM trips WHERE vehicle_id = $1 LIMIT 1', [vehicleId]);
    if (refTrips.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete vehicle because it is referenced in trips.' });
    }

    await query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
    res.json({ message: 'Vehicle deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
