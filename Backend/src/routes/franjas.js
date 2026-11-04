const express = require('express');
const router = express.Router();
const query = require('../db/query');
const authMiddleware = require('../middleware/auth');
const { soloAdmin } = require('../middleware/roles');

// GET /api/franjas/:canchaId - turnos fijos de una cancha (público)
router.get('/:canchaId', async (req, res) => {
  const { canchaId } = req.params;

  try {
    const franjas = await query(
      'SELECT * FROM franjas_horarias WHERE cancha_id = ? ORDER BY hora_inicio',
      [canchaId]
    );
    res.json(franjas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener franjas horarias' });
  }
});

// POST /api/franjas - crear franja horaria (solo admin)
router.post('/', authMiddleware, soloAdmin, async (req, res) => {
  const { cancha_id, hora_inicio, hora_fin, precio_base, precio_nocturno } = req.body;

  if (!cancha_id || !hora_inicio || !hora_fin || !precio_base) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const resultado = await query(
      'INSERT INTO franjas_horarias (cancha_id, hora_inicio, hora_fin, precio_base, precio_nocturno) VALUES (?, ?, ?, ?, ?)',
      [cancha_id, hora_inicio, hora_fin, precio_base, precio_nocturno || 0]
    );
    res.status(201).json({ mensaje: 'Franja horaria creada correctamente', id: resultado.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la franja horaria' });
  }
});

module.exports = router;
