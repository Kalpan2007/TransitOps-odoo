const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - List users (FLEET_MANAGER only)
router.get('/', authenticateJWT, authorizeRoles('FLEET_MANAGER'), async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, email, role, status, driver_id, created_at FROM users ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/users - Create a new user (FLEET_MANAGER only)
router.post('/', authenticateJWT, authorizeRoles('FLEET_MANAGER'), async (req, res, next) => {
  const { name, email, password, role, status, driver_id } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Required fields: name, email, password, role.' });
  }

  try {
    // Check unique email
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userStatus = status || 'ACTIVE';
    const linkedDriverId = (role === 'DRIVER' && driver_id) ? driver_id : null;
    const insertQuery = `
      INSERT INTO users (name, email, password_hash, role, status, driver_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, role, status, driver_id, created_at
    `;
    const result = await query(insertQuery, [name, email, passwordHash, role, userStatus, linkedDriverId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id - Update user details (FLEET_MANAGER only)
router.put('/:id', authenticateJWT, authorizeRoles('FLEET_MANAGER'), async (req, res, next) => {
  const userId = parseInt(req.params.id);
  const { name, email, password, role, status, driver_id } = req.body;

  try {
    const exists = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (email) {
      const emailExists = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, userId]);
      if (emailExists.rows.length > 0) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }
    }

    const fields = { name, email, role, status };
    // Include driver_id if provided (set to null explicitly allowed)
    if (driver_id !== undefined) fields.driver_id = driver_id || null;

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

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      queryParts.push(`password_hash = $${idx}`);
      values.push(passwordHash);
      idx++;
    }

    if (queryParts.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(userId);
    const updateQuery = `
      UPDATE users
      SET ${queryParts.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING id, name, email, role, status, driver_id, created_at
    `;

    const result = await query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id - Delete a user (FLEET_MANAGER only)
router.delete('/:id', authenticateJWT, authorizeRoles('FLEET_MANAGER'), async (req, res, next) => {
  const userId = parseInt(req.params.id);

  try {
    const exists = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent user from self-deleting
    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Self-deletion is not allowed.' });
    }

    await query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
