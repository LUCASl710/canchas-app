const express = require('express');
const router = express.Router();
const query = require('../db/query');
const authMiddleware = require('../middleware/auth');
const { soloAdmin } = require('../middleware/roles');

// GET /api/canchas - listado público de canchas activas
router.get('/', async (req, res) => {
  try {
    const canchas = await query('SELECT * FROM canchas WHERE activa = true');
    res.json(canchas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener canchas' });
  }
});

// POST /api/canchas - crear cancha nueva (solo admin)
router.post('/', authMiddleware, soloAdmin, async (req, res) => {
  const { nombre, tipo, superficie, tiene_techo, tiene_iluminacion } = req.body;

  if (!nombre || !tipo || !superficie) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const resultado = await query(
      'INSERT INTO canchas (nombre, tipo, superficie, tiene_techo, tiene_iluminacion) VALUES (?, ?, ?, ?, ?)',
      [nombre, tipo, superficie, tiene_techo, tiene_iluminacion]
    );
    res.status(201).json({ mensaje: 'Cancha creada correctamente', id: resultado.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la cancha' });
  }
});

module.exports = router;
