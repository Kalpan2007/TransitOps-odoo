const express = require('express');
const { query } = require('../config/database');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/expenses/fuel - List fuel logs with search, filter, sort
router.get('/fuel', authenticateJWT, async (req, res, next) => {
  const { search, vehicle_id, start_date, end_date, sort, order } = req.query;

  let queryText = `
    SELECT f.*, v.registration_number as vehicle_reg, v.name as vehicle_name
    FROM fuel_logs f
    LEFT JOIN vehicles v ON f.vehicle_id = v.id
    WHERE 1=1
  `;
  const queryParams = [];
  let idx = 1;

  if (search) {
    queryText += ` AND (v.registration_number ILIKE $${idx} OR v.name ILIKE $${idx})`;
    queryParams.push(`%${search}%`);
    idx++;
  }

  if (vehicle_id) {
    queryText += ` AND f.vehicle_id = $${idx}`;
    queryParams.push(vehicle_id);
    idx++;
  }

  if (start_date) {
    queryText += ` AND f.fuel_date >= $${idx}`;
    queryParams.push(start_date);
    idx++;
  }

  if (end_date) {
    queryText += ` AND f.fuel_date <= $${idx}`;
    queryParams.push(end_date);
    idx++;
  }

  const allowedSort = { id: 'f.id', fuel_date: 'f.fuel_date', fuel_cost: 'f.fuel_cost', fuel_quantity_liters: 'f.fuel_quantity_liters' };
  const sortCol = allowedSort[sort] || 'f.id';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
  queryText += ` ORDER BY ${sortCol} ${sortOrder}`;

  try {
    const result = await query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/expenses/fuel - Record a fuel log (FINANCIAL_ANALYST only)
router.post('/fuel', authenticateJWT, authorizeRoles('FINANCIAL_ANALYST'), async (req, res, next) => {
  const { vehicle_id, trip_id, fuel_quantity_liters, fuel_cost, fuel_date, odometer_reading } = req.body;

  if (!vehicle_id || !fuel_quantity_liters || !fuel_cost || !fuel_date || !odometer_reading) {
    return res.status(400).json({ error: 'Required fields: vehicle_id, fuel_quantity_liters, fuel_cost, fuel_date, odometer_reading.' });
  }

  try {
    // Verify vehicle exists
    const vehicleRes = await query('SELECT id FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const insertQuery = `
      INSERT INTO fuel_logs (vehicle_id, trip_id, fuel_quantity_liters, fuel_cost, fuel_date, odometer_reading)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(insertQuery, [
      vehicle_id, trip_id || null, fuel_quantity_liters, fuel_cost, fuel_date, odometer_reading
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/expenses/operational - List operational expenses with search, filter, sort
router.get('/operational', authenticateJWT, async (req, res, next) => {
  const { search, vehicle_id, expense_type, start_date, end_date, sort, order } = req.query;

  let queryText = `
    SELECT e.*, v.registration_number as vehicle_reg, v.name as vehicle_name
    FROM expenses e
    LEFT JOIN vehicles v ON e.vehicle_id = v.id
    WHERE 1=1
  `;
  const queryParams = [];
  let idx = 1;

  if (search) {
    queryText += ` AND (v.registration_number ILIKE $${idx} OR v.name ILIKE $${idx} OR e.description ILIKE $${idx} OR e.expense_type ILIKE $${idx})`;
    queryParams.push(`%${search}%`);
    idx++;
  }

  if (vehicle_id) {
    queryText += ` AND e.vehicle_id = $${idx}`;
    queryParams.push(vehicle_id);
    idx++;
  }

  if (expense_type) {
    queryText += ` AND e.expense_type = $${idx}`;
    queryParams.push(expense_type);
    idx++;
  }

  if (start_date) {
    queryText += ` AND e.expense_date >= $${idx}`;
    queryParams.push(start_date);
    idx++;
  }

  if (end_date) {
    queryText += ` AND e.expense_date <= $${idx}`;
    queryParams.push(end_date);
    idx++;
  }

  const allowedSort = { id: 'e.id', expense_date: 'e.expense_date', amount: 'e.amount', expense_type: 'e.expense_type' };
  const sortCol = allowedSort[sort] || 'e.id';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
  queryText += ` ORDER BY ${sortCol} ${sortOrder}`;

  try {
    const result = await query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/expenses/operational - Record an operational expense (FINANCIAL_ANALYST only)
router.post('/operational', authenticateJWT, authorizeRoles('FINANCIAL_ANALYST'), async (req, res, next) => {
  const { vehicle_id, trip_id, expense_type, description, amount, expense_date } = req.body;

  if (!vehicle_id || !expense_type || !amount || !expense_date) {
    return res.status(400).json({ error: 'Required fields: vehicle_id, expense_type, amount, expense_date.' });
  }

  try {
    // Verify vehicle exists
    const vehicleRes = await query('SELECT id FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const insertQuery = `
      INSERT INTO expenses (vehicle_id, trip_id, expense_type, description, amount, expense_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(insertQuery, [
      vehicle_id, trip_id || null, expense_type, description, amount, expense_date
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
