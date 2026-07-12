const express = require('express');
const { pool, query } = require('../config/database');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { sendMaintenanceStartedEmail, sendMaintenanceCompletedEmail } = require('../utils/email');

const router = express.Router();

// GET /api/maintenance - List maintenance records with search, filter, sort
router.get('/', authenticateJWT, async (req, res, next) => {
  const { search, status, vehicle_id, sort, order } = req.query;

  let queryText = `
    SELECT m.*, v.registration_number as vehicle_reg, v.name as vehicle_name
    FROM maintenance_logs m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    WHERE 1=1
  `;
  const queryParams = [];
  let idx = 1;

  if (search) {
    queryText += ` AND (v.registration_number ILIKE $${idx} OR v.name ILIKE $${idx} OR m.maintenance_type ILIKE $${idx} OR m.description ILIKE $${idx})`;
    queryParams.push(`%${search}%`);
    idx++;
  }

  if (status) {
    queryText += ` AND m.status = $${idx}`;
    queryParams.push(status);
    idx++;
  }

  if (vehicle_id) {
    queryText += ` AND m.vehicle_id = $${idx}`;
    queryParams.push(vehicle_id);
    idx++;
  }

  const allowedSort = { id: 'm.id', start_date: 'm.start_date', maintenance_cost: 'm.maintenance_cost', status: 'm.status' };
  const sortCol = allowedSort[sort] || 'm.id';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
  queryText += ` ORDER BY ${sortCol} ${sortOrder}`;

  try {
    const result = await query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/maintenance - Create active maintenance record (FLEET_MANAGER + DISPATCHER)
router.post('/', authenticateJWT, authorizeRoles('FLEET_MANAGER', 'DISPATCHER'), async (req, res, next) => {
  const { vehicle_id, maintenance_type, description, start_date, maintenance_cost } = req.body;

  if (!vehicle_id || !maintenance_type || !start_date) {
    return res.status(400).json({ error: 'Required fields: vehicle_id, maintenance_type, start_date.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock vehicle row
    const vehicleRes = await client.query('SELECT * FROM vehicles WHERE id = $1 FOR UPDATE', [vehicle_id]);
    if (vehicleRes.rows.length === 0) {
      throw { status: 404, message: 'Vehicle not found.' };
    }
    const vehicle = vehicleRes.rows[0];

    if (vehicle.status === 'RETIRED') {
      throw { status: 400, message: 'Cannot place a retired vehicle in maintenance.' };
    }

    if (vehicle.status === 'ON_TRIP') {
      throw { status: 400, message: 'Cannot place an active trip vehicle in maintenance.' };
    }

    // Insert maintenance log
    const cost = maintenance_cost !== undefined ? parseFloat(maintenance_cost) : 0.0;
    const insertQuery = `
      INSERT INTO maintenance_logs (vehicle_id, maintenance_type, description, start_date, maintenance_cost, status)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      RETURNING *
    `;
    const maintRes = await client.query(insertQuery, [vehicle_id, maintenance_type, description, start_date, cost]);

    // Update Vehicle status to IN_SHOP
    await client.query('UPDATE vehicles SET status = \'IN_SHOP\', updated_at = NOW() WHERE id = $1', [vehicle_id]);

    await client.query('COMMIT');

    // Notify fleet managers that a vehicle has entered maintenance
    try {
      const managersRes = await query(
        "SELECT email FROM users WHERE role IN ('FLEET_MANAGER', 'DISPATCHER') AND status = 'ACTIVE' LIMIT 3"
      );
      managersRes.rows.forEach(u =>
        sendMaintenanceStartedEmail(u.email, vehicle, maintRes.rows[0]).catch(err =>
          console.error('[SMTP] Maintenance start email failed:', err.message)
        )
      );
    } catch (e) {
      console.error('[SMTP] Could not send maintenance start email:', e.message);
    }

    res.status(201).json(maintRes.rows[0]);
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

// POST /api/maintenance/:id/complete - Complete maintenance (FLEET_MANAGER + DISPATCHER)
router.post('/:id/complete', authenticateJWT, authorizeRoles('FLEET_MANAGER', 'DISPATCHER'), async (req, res, next) => {
  const maintId = parseInt(req.params.id);
  const { end_date, maintenance_cost } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get maintenance record
    const maintRes = await client.query('SELECT * FROM maintenance_logs WHERE id = $1 FOR UPDATE', [maintId]);
    if (maintRes.rows.length === 0) {
      throw { status: 404, message: 'Maintenance record not found.' };
    }
    const maint = maintRes.rows[0];

    if (maint.status === 'COMPLETED') {
      throw { status: 400, message: 'Maintenance is already completed.' };
    }

    // Lock vehicle row
    const vehicleRes = await client.query('SELECT * FROM vehicles WHERE id = $1 FOR UPDATE', [maint.vehicle_id]);
    const vehicle = vehicleRes.rows[0];

    // Update maintenance log to COMPLETED
    const cost = maintenance_cost !== undefined ? parseFloat(maintenance_cost) : maint.maintenance_cost;
    const resolvedEndDate = end_date || new Date().toISOString().split('T')[0];

    await client.query(
      'UPDATE maintenance_logs SET status = \'COMPLETED\', end_date = $1, maintenance_cost = $2, updated_at = NOW() WHERE id = $3',
      [resolvedEndDate, cost, maintId]
    );

    // Update vehicle status from IN_SHOP to AVAILABLE, unless RETIRED
    if (vehicle.status !== 'RETIRED') {
      await client.query('UPDATE vehicles SET status = \'AVAILABLE\', updated_at = NOW() WHERE id = $1', [vehicle.id]);
    }

    // Add operational expense log for bookkeeping
    await client.query(
      `INSERT INTO expenses (vehicle_id, expense_type, description, amount, expense_date)
       VALUES ($1, 'MAINTENANCE', $2, $3, $4)`,
      [vehicle.id, `Maintenance completed: ${maint.maintenance_type}`, cost, resolvedEndDate]
    );

    await client.query('COMMIT');

    // Notify fleet managers that vehicle is back in service
    try {
      const managersRes = await query(
        "SELECT email FROM users WHERE role IN ('FLEET_MANAGER', 'DISPATCHER') AND status = 'ACTIVE' LIMIT 3"
      );
      const completedMaint = { ...maint, end_date: resolvedEndDate, maintenance_cost: cost };
      managersRes.rows.forEach(u =>
        sendMaintenanceCompletedEmail(u.email, vehicle, completedMaint).catch(err =>
          console.error('[SMTP] Maintenance complete email failed:', err.message)
        )
      );
    } catch (e) {
      console.error('[SMTP] Could not send maintenance complete email:', e.message);
    }

    res.json({ message: 'Maintenance completed successfully.' });
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

module.exports = router;
