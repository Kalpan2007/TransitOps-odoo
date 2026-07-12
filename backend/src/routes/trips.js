const express = require('express');
const { pool, query } = require('../config/database');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const {
  sendTripDispatchedEmail,
  sendTripCompletedEmail,
  sendTripCancelledEmail,
} = require('../utils/email');

const router = express.Router();

// Helper to get average fuel price dynamically from existing logs
const getDynamicFuelPrice = async (clientOrPool) => {
  try {
    const res = await clientOrPool.query('SELECT SUM(fuel_cost) / SUM(fuel_quantity_liters) as avg_price FROM fuel_logs');
    if (res.rows[0] && res.rows[0].avg_price) {
      return parseFloat(parseFloat(res.rows[0].avg_price).toFixed(2));
    }
  } catch (e) {
    console.error('Error fetching dynamic fuel price:', e);
  }
  return 95.00; // fallback default
};

// GET /api/trips - List trips with status filtering
router.get('/', authenticateJWT, async (req, res, next) => {
  const { status, vehicle_id, driver_id, search, sort, order } = req.query;

  try {
    let queryText = `
      SELECT t.*, 
             v.registration_number as vehicle_reg, v.name as vehicle_name,
             d.name as driver_name, d.license_number as driver_license
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE 1=1
    `;
    const queryParams = [];
    let idx = 1;

    if (search) {
      queryText += ` AND (t.trip_code ILIKE $${idx} OR t.source ILIKE $${idx} OR t.destination ILIKE $${idx} OR v.registration_number ILIKE $${idx} OR d.name ILIKE $${idx})`;
      queryParams.push(`%${search}%`);
      idx++;
    }

    if (status) {
      queryText += ` AND t.status = $${idx}`;
      queryParams.push(status);
      idx++;
    }

    if (vehicle_id) {
      queryText += ` AND t.vehicle_id = $${idx}`;
      queryParams.push(vehicle_id);
      idx++;
    }

    if (driver_id) {
      queryText += ` AND t.driver_id = $${idx}`;
      queryParams.push(driver_id);
      idx++;
    }

    const allowedSort = { id: 't.id', trip_code: 't.trip_code', cargo_weight: 't.cargo_weight', planned_distance: 't.planned_distance', status: 't.status', source: 't.source', destination: 't.destination', created_at: 't.created_at' };
    const sortCol = allowedSort[sort] || 't.id';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
    queryText += ` ORDER BY ${sortCol} ${sortOrder}`;

    const result = await query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/trips/my-trips - DRIVER sees only their own assigned trips
router.get('/my-trips', authenticateJWT, authorizeRoles('DRIVER'), async (req, res, next) => {
  try {
    // Find the driver entity linked to this user account
    const userRes = await query('SELECT driver_id FROM users WHERE id = $1', [req.user.userId]);
    const driverId = userRes.rows[0]?.driver_id;
    if (!driverId) {
      return res.status(400).json({ error: 'Your account is not linked to a driver profile. Contact Fleet Manager.' });
    }

    const result = await query(`
      SELECT t.*,
             v.registration_number as vehicle_reg, v.name as vehicle_name,
             v.model as vehicle_model, v.type as vehicle_type,
             d.name as driver_name, d.license_number as driver_license
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE t.driver_id = $1
      ORDER BY t.id DESC
    `, [driverId]);

    res.json({ trips: result.rows, driver_id: driverId });
  } catch (error) {
    next(error);
  }
});

// GET /api/trips/:id - Trip details
router.get('/:id', authenticateJWT, async (req, res, next) => {
  const tripId = parseInt(req.params.id);

  try {
    const tripRes = await query(`
      SELECT t.*, 
             v.registration_number as vehicle_reg, v.name as vehicle_name, v.model as vehicle_model, v.type as vehicle_type,
             d.name as driver_name, d.license_number as driver_license, d.contact_number as driver_contact
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE t.id = $1
    `, [tripId]);

    if (tripRes.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    res.json(tripRes.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/trips - Create DRAFT trip (DISPATCHER + FLEET_MANAGER)
router.post('/', authenticateJWT, authorizeRoles('DISPATCHER', 'FLEET_MANAGER'), async (req, res, next) => {
  const { source, destination, cargo_weight, planned_distance, vehicle_id, driver_id, revenue } = req.body;

  if (!source || !destination || !cargo_weight || !planned_distance || !vehicle_id || !driver_id) {
    return res.status(400).json({ error: 'Required fields: source, destination, cargo_weight, planned_distance, vehicle_id, driver_id.' });
  }

  try {
    // Validate vehicle and driver suitability
    const vehicleRes = await query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleRes.rows.length === 0) {
      return res.status(400).json({ error: 'Vehicle does not exist.' });
    }
    const vehicle = vehicleRes.rows[0];

    const driverRes = await query('SELECT * FROM drivers WHERE id = $1', [driver_id]);
    if (driverRes.rows.length === 0) {
      return res.status(400).json({ error: 'Driver does not exist.' });
    }
    const driver = driverRes.rows[0];

    if (parseFloat(cargo_weight) > parseFloat(vehicle.maximum_load_capacity)) {
      return res.status(400).json({ error: `Cargo weight exceeds the vehicle's maximum load capacity.` });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const expiryStr = new Date(driver.license_expiry_date).toISOString().split('T')[0];
    if (expiryStr < todayStr) {
      return res.status(400).json({ error: 'Driver license has expired.' });
    }

    if (driver.status === 'SUSPENDED') {
      return res.status(400).json({ error: 'Driver is suspended.' });
    }

    // Generate a unique trip code (e.g., TRP-<timestamp or random sequence>)
    const tripCountRes = await query('SELECT count(*) FROM trips');
    const tripNum = parseInt(tripCountRes.rows[0].count) + 101;
    const trip_code = `TRP-${tripNum}-${Date.now().toString().slice(-4)}`;

    const insertQuery = `
      INSERT INTO trips (trip_code, source, destination, cargo_weight, planned_distance, vehicle_id, driver_id, revenue, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT')
      RETURNING *
    `;
    const rev = revenue !== undefined ? parseFloat(revenue) : 0.0;
    const result = await query(insertQuery, [trip_code, source, destination, cargo_weight, planned_distance, vehicle_id, driver_id, rev]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/trips/:id/dispatch - Dispatch Trip (DISPATCHER + FLEET_MANAGER) - CONCURRENT ATOMIC TRANSACTION
router.post('/:id/dispatch', authenticateJWT, authorizeRoles('DISPATCHER', 'FLEET_MANAGER'), async (req, res, next) => {
  const tripId = parseInt(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the trip and lock it for update
    const tripRes = await client.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [tripId]);
    if (tripRes.rows.length === 0) {
      throw { status: 404, message: 'Trip not found.' };
    }
    const trip = tripRes.rows[0];

    if (trip.status !== 'DRAFT') {
      throw { status: 400, message: `Cannot dispatch a trip that is in status '${trip.status}'.` };
    }

    // 2. Lock vehicle and driver rows using SELECT FOR UPDATE
    const vehicleRes = await client.query('SELECT * FROM vehicles WHERE id = $1 FOR UPDATE', [trip.vehicle_id]);
    if (vehicleRes.rows.length === 0) {
      throw { status: 400, message: 'Vehicle does not exist.' };
    }
    const vehicle = vehicleRes.rows[0];

    const driverRes = await client.query('SELECT * FROM drivers WHERE id = $1 FOR UPDATE', [trip.driver_id]);
    if (driverRes.rows.length === 0) {
      throw { status: 400, message: 'Driver does not exist.' };
    }
    const driver = driverRes.rows[0];

    // 3. VALIDATIONS

    // VALIDATION 9: Vehicle must not be IN_SHOP.
    if (vehicle.status === 'IN_SHOP') {
      throw { status: 400, message: 'Vehicle is not available for dispatch.' };
    }

    // VALIDATION 10: Vehicle must not be RETIRED.
    if (vehicle.status === 'RETIRED') {
      throw { status: 400, message: 'Vehicle is not available for dispatch.' };
    }

    // VALIDATION 3: Vehicle status must be AVAILABLE.
    if (vehicle.status !== 'AVAILABLE') {
      throw { status: 400, message: 'Vehicle is not available for dispatch.' };
    }

    // VALIDATION 6: Driver must not be SUSPENDED.
    if (driver.status === 'SUSPENDED') {
      throw { status: 400, message: 'Driver is currently unavailable.' };
    }

    // VALIDATION 4: Driver status must be AVAILABLE.
    if (driver.status !== 'AVAILABLE') {
      throw { status: 400, message: 'Driver is currently unavailable.' };
    }

    // VALIDATION 5: Driver license must not be expired.
    const todayStr = new Date().toISOString().split('T')[0];
    const expiryStr = new Date(driver.license_expiry_date).toISOString().split('T')[0];
    if (expiryStr < todayStr) {
      throw { status: 400, message: 'Driver license has expired and the driver cannot be assigned to this trip.' };
    }

    // VALIDATION 7: Vehicle must not already have an active DISPATCHED trip.
    const activeVehicleTrip = await client.query('SELECT id FROM trips WHERE vehicle_id = $1 AND status = \'DISPATCHED\'', [vehicle.id]);
    if (activeVehicleTrip.rows.length > 0) {
      throw { status: 400, message: 'Vehicle is not available for dispatch.' };
    }

    // VALIDATION 8: Driver must not already have an active DISPATCHED trip.
    const activeDriverTrip = await client.query('SELECT id FROM trips WHERE driver_id = $1 AND status = \'DISPATCHED\'', [driver.id]);
    if (activeDriverTrip.rows.length > 0) {
      throw { status: 400, message: 'Driver is currently unavailable.' };
    }

    // VALIDATION 11: Cargo Weight must not exceed Maximum Load Capacity.
    const weightDiff = parseFloat(trip.cargo_weight) - parseFloat(vehicle.maximum_load_capacity);
    if (weightDiff > 0) {
      throw {
        status: 400,
        message: `Cargo weight exceeds the vehicle's maximum load capacity by ${weightDiff} KG.`
      };
    }

    // 4. PERFORM STATE CHANGES
    // Trip: DRAFT -> DISPATCHED
    const updatedTrip = await client.query(
      'UPDATE trips SET status = \'DISPATCHED\', dispatched_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
      [tripId]
    );

    // Vehicle: AVAILABLE -> ON_TRIP
    await client.query('UPDATE vehicles SET status = \'ON_TRIP\', updated_at = NOW() WHERE id = $1', [vehicle.id]);

    // Driver: AVAILABLE -> ON_TRIP
    await client.query('UPDATE drivers SET status = \'ON_TRIP\', updated_at = NOW() WHERE id = $1', [driver.id]);

    await client.query('COMMIT');

    // Send trip-dispatched email to driver (look up linked user account email)
    try {
      const driverUserRes = await query(
        'SELECT u.email FROM users u WHERE u.driver_id = $1 LIMIT 1',
        [driver.id]
      );
      if (driverUserRes.rows.length > 0) {
        sendTripDispatchedEmail(driverUserRes.rows[0].email, updatedTrip.rows[0], vehicle, driver).catch(err =>
          console.error('[SMTP] Dispatch email failed:', err.message)
        );
      }
    } catch (e) {
      console.error('[SMTP] Could not send dispatch email:', e.message);
    }

    res.json(updatedTrip.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) {
      res.status(error.status).json({ error: error.message });
    } else {
      next(error);
    }
  } finally {
    client.release();
  }
});

// POST /api/trips/:id/complete - Complete Trip (DISPATCHER + FLEET_MANAGER + DRIVER)
router.post('/:id/complete', authenticateJWT, authorizeRoles('DISPATCHER', 'FLEET_MANAGER', 'DRIVER'), async (req, res, next) => {
  const tripId = parseInt(req.params.id);
  const { final_odometer, fuel_consumed } = req.body;

  if (final_odometer === undefined || fuel_consumed === undefined) {
    return res.status(400).json({ error: 'Required fields: final_odometer, fuel_consumed.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the trip
    const tripRes = await client.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [tripId]);
    if (tripRes.rows.length === 0) { throw { status: 404, message: 'Trip not found.' }; }
    const trip = tripRes.rows[0];

    // If DRIVER, validate they own this trip
    if (req.user.role === 'DRIVER') {
      const userRes = await client.query('SELECT driver_id FROM users WHERE id = $1', [req.user.userId]);
      const myDriverId = userRes.rows[0]?.driver_id;
      if (!myDriverId || trip.driver_id !== myDriverId) {
        throw { status: 403, message: 'You can only complete trips assigned to you.' };
      }
    }

    if (trip.status !== 'DISPATCHED') {
      throw { status: 400, message: 'Only dispatched trips can be completed.' };
    }

    // 2. Lock vehicle
    const vehicleRes = await client.query('SELECT * FROM vehicles WHERE id = $1 FOR UPDATE', [trip.vehicle_id]);
    const vehicle = vehicleRes.rows[0];

    // Validate odometer
    if (parseFloat(final_odometer) < parseFloat(vehicle.current_odometer)) {
      throw { status: 400, message: `Final odometer (${final_odometer}) cannot be less than vehicle's current odometer (${vehicle.current_odometer}).` };
    }

    // Calculate actual distance traveled during this trip
    const distanceTravelled = parseFloat(final_odometer) - parseFloat(vehicle.current_odometer);

    // 3. Updates
    // Trip: DISPATCHED -> COMPLETED
    await client.query(
      'UPDATE trips SET status = \'COMPLETED\', final_odometer = $1, fuel_consumed = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3',
      [final_odometer, fuel_consumed, tripId]
    );

    // Vehicle: ON_TRIP -> AVAILABLE, update current_odometer
    await client.query(
      'UPDATE vehicles SET status = \'AVAILABLE\', current_odometer = $1, updated_at = NOW() WHERE id = $2',
      [final_odometer, vehicle.id]
    );

    // Driver: ON_TRIP -> AVAILABLE
    await client.query(
      'UPDATE drivers SET status = \'AVAILABLE\', updated_at = NOW() WHERE id = $1',
      [trip.driver_id]
    );

    // 4. Create linked fuel log automatically
    const fuelCostPerLiter = await getDynamicFuelPrice(client);
    const totalFuelCost = parseFloat(fuel_consumed) * fuelCostPerLiter;
    await client.query(
      `INSERT INTO fuel_logs (vehicle_id, trip_id, fuel_quantity_liters, fuel_cost, fuel_date, odometer_reading)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [vehicle.id, tripId, fuel_consumed, totalFuelCost, final_odometer]
    );

    await client.query('COMMIT');

    // Send trip-completed email — find the dispatcher/manager who can see reports
    try {
      const managersRes = await query(
        "SELECT email FROM users WHERE role IN ('FLEET_MANAGER', 'DISPATCHER') AND status = 'ACTIVE' LIMIT 3"
      );
      const completedTrip = { ...trip, final_odometer, fuel_consumed };
      managersRes.rows.forEach(u =>
        sendTripCompletedEmail(u.email, completedTrip, driver, vehicle, distanceTravelled).catch(err =>
          console.error('[SMTP] Complete email failed:', err.message)
        )
      );
    } catch (e) {
      console.error('[SMTP] Could not send completion email:', e.message);
    }

    res.json({ message: 'Trip completed successfully.', distanceTravelled });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) {
      res.status(error.status).json({ error: error.message });
    } else {
      next(error);
    }
  } finally {
    client.release();
  }
});

// POST /api/trips/:id/cancel - Cancel Trip (DISPATCHER + FLEET_MANAGER)
router.post('/:id/cancel', authenticateJWT, authorizeRoles('DISPATCHER', 'FLEET_MANAGER'), async (req, res, next) => {
  const tripId = parseInt(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tripRes = await client.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [tripId]);
    if (tripRes.rows.length === 0) {
      throw { status: 404, message: 'Trip not found.' };
    }
    const trip = tripRes.rows[0];

    if (trip.status === 'COMPLETED') {
      throw { status: 400, message: 'Completed trips cannot be cancelled.' };
    }

    if (trip.status === 'CANCELLED') {
      throw { status: 400, message: 'Trip is already cancelled.' };
    }

    if (trip.status === 'DISPATCHED') {
      // Restore vehicle & driver back to AVAILABLE
      await client.query('UPDATE vehicles SET status = \'AVAILABLE\', updated_at = NOW() WHERE id = $1', [trip.vehicle_id]);
      await client.query('UPDATE drivers SET status = \'AVAILABLE\', updated_at = NOW() WHERE id = $1', [trip.driver_id]);
    }

    // Cancel Trip
    const cancelledTrip = await client.query(
      'UPDATE trips SET status = \'CANCELLED\', updated_at = NOW() WHERE id = $1 RETURNING *',
      [tripId]
    );

    await client.query('COMMIT');

    // Send cancellation email to dispatcher/manager
    try {
      const managersRes = await query(
        "SELECT email FROM users WHERE role IN ('FLEET_MANAGER', 'DISPATCHER') AND status = 'ACTIVE' LIMIT 3"
      );
      managersRes.rows.forEach(u =>
        sendTripCancelledEmail(u.email, cancelledTrip.rows[0]).catch(err =>
          console.error('[SMTP] Cancel email failed:', err.message)
        )
      );
    } catch (e) {
      console.error('[SMTP] Could not send cancellation email:', e.message);
    }

    res.json(cancelledTrip.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) {
      res.status(error.status).json({ error: error.message });
    } else {
      next(error);
    }
  } finally {
    client.release();
  }
});

// POST /api/trips/recommend-resources - Smart Dispatch Recommendation (DISPATCHER + FLEET_MANAGER)
router.post('/recommend-resources', authenticateJWT, authorizeRoles('DISPATCHER', 'FLEET_MANAGER'), async (req, res, next) => {
  const { cargo_weight, planned_distance } = req.body;

  if (cargo_weight === undefined || planned_distance === undefined) {
    return res.status(400).json({ error: 'Required fields: cargo_weight, planned_distance.' });
  }

  try {
    const weight = parseFloat(cargo_weight);
    const distance = parseFloat(planned_distance);

    // Get dynamic fuel price
    const fuelCostPerLiter = await getDynamicFuelPrice(pool);

    // 1. Fetch available vehicles (excluding those already assigned to DRAFT or DISPATCHED trips)
    const vehiclesRes = await query(`
      SELECT * FROM vehicles 
      WHERE status = 'AVAILABLE'
        AND id NOT IN (
          SELECT DISTINCT vehicle_id FROM trips WHERE status IN ('DRAFT', 'DISPATCHED') AND vehicle_id IS NOT NULL
        )
    `);
    const availableVehicles = vehiclesRes.rows;

    // Filter vehicles that can handle the cargo weight
    const eligibleVehicles = availableVehicles.filter(v => parseFloat(v.maximum_load_capacity) >= weight);

    // Score vehicles based on capacity fit and estimated fuel requirements
    const vehicleRecommendations = [];
    for (const vehicle of eligibleVehicles) {
      // Calculate historical fuel efficiency
      const histRes = await query(
        'SELECT SUM(planned_distance) as dist, SUM(fuel_consumed) as fuel FROM trips WHERE vehicle_id = $1 AND status = \'COMPLETED\'',
        [vehicle.id]
      );
      const distSum = parseFloat(histRes.rows[0].dist) || 0;
      const fuelSum = parseFloat(histRes.rows[0].fuel) || 0;

      let efficiency = 8.0; // Default fallback efficiency in KM/L
      if (distSum > 0 && fuelSum > 0) {
        efficiency = distSum / fuelSum;
      } else {
        // Dynamic fallback based on average efficiency of the SAME vehicle type from other completed trips
        try {
          const typeAvgRes = await query(
            `SELECT SUM(t.planned_distance) as dist, SUM(t.fuel_consumed) as fuel 
             FROM trips t 
             JOIN vehicles v ON t.vehicle_id = v.id 
             WHERE v.type = $1 AND t.status = 'COMPLETED'`,
            [vehicle.type]
          );
          const typeDist = parseFloat(typeAvgRes.rows[0].dist) || 0;
          const typeFuel = parseFloat(typeAvgRes.rows[0].fuel) || 0;
          if (typeDist > 0 && typeFuel > 0) {
            efficiency = typeDist / typeFuel;
          } else {
            // Fallback defaults based on type
            if (vehicle.type.toLowerCase() === 'van') efficiency = 12.0;
            else if (vehicle.type.toLowerCase() === 'truck') efficiency = 6.0;
            else if (vehicle.type.toLowerCase() === 'flatbed') efficiency = 4.5;
          }
        } catch (e) {
          if (vehicle.type.toLowerCase() === 'van') efficiency = 12.0;
          else if (vehicle.type.toLowerCase() === 'truck') efficiency = 6.0;
          else if (vehicle.type.toLowerCase() === 'flatbed') efficiency = 4.5;
        }
      }

      const capacityDiff = parseFloat(vehicle.maximum_load_capacity) - weight;
      const estimatedFuelRequired = distance / efficiency;
      const estimatedFuelCost = estimatedFuelRequired * fuelCostPerLiter;

      vehicleRecommendations.push({
        ...vehicle,
        efficiencyKmL: parseFloat(efficiency.toFixed(2)),
        capacityDifferenceKg: capacityDiff,
        estimatedFuelLiters: parseFloat(estimatedFuelRequired.toFixed(2)),
        estimatedFuelCost: parseFloat(estimatedFuelCost.toFixed(2)),
        // Ranks: prefer closer capacity matches (smaller difference) to prevent using huge trucks for tiny loads
        score: capacityDiff * 0.4 + estimatedFuelCost * 0.6
      });
    }

    // Sort vehicles: lowest score first (best balance of capacity fit & fuel economy)
    vehicleRecommendations.sort((a, b) => a.score - b.score);

    // 2. Fetch available drivers with valid licenses (filtered natively in SQL to avoid timezone/formatting bugs)
    const driversRes = await query(`
      SELECT * FROM drivers 
      WHERE status = 'AVAILABLE' 
        AND license_expiry_date >= CURRENT_DATE
        AND id NOT IN (
          SELECT DISTINCT driver_id FROM trips WHERE status IN ('DRAFT', 'DISPATCHED') AND driver_id IS NOT NULL
        )
    `);
    const eligibleDrivers = driversRes.rows;

    // Rank drivers: prefer highest safety score first
    const driverRecommendations = eligibleDrivers.map(d => ({
      ...d,
      licenseValidityDays: Math.ceil((new Date(d.license_expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    }));
    driverRecommendations.sort((a, b) => b.safety_score - a.safety_score);

    // 3. Assemble recommendation details
    const recommendedVehicle = vehicleRecommendations[0] || null;
    const recommendedDriver = driverRecommendations[0] || null;

    const vehicleReasons = [];
    if (recommendedVehicle) {
      vehicleReasons.push(`Maximum capacity (${recommendedVehicle.maximum_load_capacity} KG) accommodates your cargo of ${weight} KG.`);
      vehicleReasons.push(`High estimated efficiency of ${recommendedVehicle.efficiencyKmL} KM/L minimizes estimated trip fuel cost to $${recommendedVehicle.estimatedFuelCost}.`);
      if (recommendedVehicle.capacityDifferenceKg < 100) {
        vehicleReasons.push(`Excellent capacity sizing match (only ${recommendedVehicle.capacityDifferenceKg} KG excess weight capacity).`);
      }
    }

    const driverReasons = [];
    if (recommendedDriver) {
      driverReasons.push(`Driver status is AVAILABLE and license is valid (expires in ${recommendedDriver.licenseValidityDays} days).`);
      driverReasons.push(`High historical road safety performance score of ${recommendedDriver.safety_score}/100.`);
    }

    res.json({
      recommendedVehicle: recommendedVehicle ? {
        vehicle: recommendedVehicle,
        reasons: vehicleReasons
      } : null,
      recommendedDriver: recommendedDriver ? {
        driver: recommendedDriver,
        reasons: driverReasons
      } : null,
      alternatives: {
        vehicles: vehicleRecommendations.slice(1),
        drivers: driverRecommendations.slice(1)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

