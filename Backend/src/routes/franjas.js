const express = require('express');
const router = express.Router();
const query = require('../db/query');
const authMiddleware = require('../middleware/auth');
const { soloAdmin } = require('../middleware/roles');
const { calcularMonto, esHorarioNocturno } = require('../utils/precios');

// GET /api/franjas/:canchaId - turnos fijos de una cancha (público)
// Devuelve el precio que se cobraría hoy en cada franja (`precio_vigente`),
// así el cliente ve el precio real antes de reservar.
router.get('/:canchaId', async (req, res) => {
  const { canchaId } = req.params;

  try {
    const franjas = await query(
      'SELECT * FROM franjas_horarias WHERE cancha_id = ? ORDER BY hora_inicio',
      [canchaId]
    );

    const conPrecio = franjas.map((franja) => ({
      ...franja,
      es_nocturna: esHorarioNocturno(franja.hora_inicio),
      precio_vigente: calcularMonto(franja),
    }));

    res.json(conPrecio);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener franjas horarias' });
  }
});

// POST /api/franjas - crear franja horaria (solo admin)
router.post('/', authMiddleware, soloAdmin, async (req, res) => {
  const { cancha_id, hora_inicio, hora_fin, precio_base, precio_nocturno } = req.body || {};

  if (!cancha_id || !hora_inicio || !hora_fin || precio_base === undefined || precio_base === '') {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const base = Number(precio_base);
  const nocturno = Number(precio_nocturno || 0);

  if (!Number.isFinite(base) || base < 0 || !Number.isFinite(nocturno) || nocturno < 0) {
    return res.status(400).json({ error: 'Los precios deben ser números mayores o iguales a 0' });
  }

  if (String(hora_inicio) >= String(hora_fin)) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio' });
  }

  try {
    const canchas = await query('SELECT id FROM canchas WHERE id = ?', [cancha_id]);
    if (canchas.length === 0) {
      return res.status(400).json({ error: 'La cancha no existe' });
    }

    const resultado = await query(
      'INSERT INTO franjas_horarias (cancha_id, hora_inicio, hora_fin, precio_base, precio_nocturno) VALUES (?, ?, ?, ?, ?)',
      [cancha_id, hora_inicio, hora_fin, base, nocturno]
    );

    res.status(201).json({ mensaje: 'Franja horaria creada correctamente', id: resultado.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la franja horaria' });
  }
});

module.exports = router;
