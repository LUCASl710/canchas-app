const express = require('express');
const router = express.Router();
const query = require('../db/query');
const authMiddleware = require('../middleware/auth');
const { soloAdmin } = require('../middleware/roles');

// GET /api/usuarios  (solo admin)
// Importante: se listan columnas explícitas. NUNCA password_hash.
router.get('/', authMiddleware, soloAdmin, async (req, res) => {
  const sql = `
    SELECT id, nombre, apellido, email, telefono, rol, activo, created_at
    FROM usuarios
    ORDER BY id
  `;

  try {
    const usuarios = await query(sql);
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

module.exports = router;
