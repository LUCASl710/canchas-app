const express = require('express');
const router = express.Router();
const query = require('../db/query');
const pool = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { soloAdmin } = require('../middleware/roles');
const { Preference } = require('mercadopago');
const mp = require('../config/mercadopago');

// GET /api/reservas
// Admin: ve todas las reservas. Cliente: ve SOLO las suyas.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const esAdmin = req.user.rol === 'admin';

    let sql = `
      SELECT r.id, r.fecha, r.monto_total, r.estado, r.metodo_pago,
             u.nombre, u.apellido, u.email,
             c.nombre AS cancha_nombre, c.tipo AS cancha_tipo,
             f.hora_inicio, f.hora_fin
      FROM reservas r
      JOIN usuarios u ON u.id = r.usuario_id
      JOIN canchas c ON c.id = r.cancha_id
      JOIN franjas_horarias f ON f.id = r.franja_id
    `;
    const condiciones = [];
    const params = [];

    if (!esAdmin) {
      condiciones.push('r.usuario_id = ?');
      params.push(req.user.id);
    }

    // Filtro opcional por día (lo usa el panel del admin).
    if (req.query.fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)) {
        return res.status(400).json({ error: 'Fecha inválida' });
      }
      condiciones.push('r.fecha = ?');
      params.push(req.query.fecha);
    }

    if (condiciones.length > 0) {
      sql += ' WHERE ' + condiciones.join(' AND ');
    }

    sql += ' ORDER BY r.fecha DESC, f.hora_inicio ASC';

    const resultados = await query(sql, params);
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// POST /api/reservas
// El usuario sale del token (req.user.id), NUNCA del body.
// El monto también lo calcula el servidor.
//
// Anti-doble-reserva:
//   1. Transacción sobre una conexión exclusiva del pool.
//   2. SELECT ... FOR UPDATE sobre franjas_horarias: esa fila SIEMPRE existe,
//      así que el lock siempre se toma y serializa los intentos sobre el turno.
//   3. La verificación de disponibilidad ocurre con el lock ya tomado.
router.post('/', authMiddleware, async (req, res) => {
  const { cancha_id, franja_id, fecha, metodo_pago } = req.body;
  const usuario_id = req.user.id;

  if (!cancha_id || !franja_id || !fecha || !metodo_pago) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  if (!['efectivo', 'mercadopago', 'qr_presencial'].includes(metodo_pago)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  let conn = null;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. LOCK de la franja. Debe ser lo PRIMERO dentro de la transacción.
    const [franjas] = await conn.query(
      'SELECT id, precio_base FROM franjas_horarias WHERE id = ? AND cancha_id = ? FOR UPDATE',
      [franja_id, cancha_id]
    );

    if (franjas.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'La franja no pertenece a esa cancha' });
    }

    // 2. No se puede reservar en el pasado.
    const [pasado] = await conn.query('SELECT ? < CURDATE() AS esPasado', [fecha]);
    if (pasado[0].esPasado) {
      await conn.rollback();
      return res.status(400).json({ error: 'No podés reservar una fecha pasada' });
    }

    // 3. Disponibilidad. Ya tenemos el lock, nadie más puede estar acá.
    const [ocupadas] = await conn.query(
      "SELECT id FROM reservas WHERE franja_id = ? AND fecha = ? AND estado != 'cancelada' FOR UPDATE",
      [franja_id, fecha]
    );

    if (ocupadas.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'El turno ya está reservado' });
    }

    // 4. Insertar. El precio sale de la base, no del cliente.
    const monto_total = franjas[0].precio_base;
    const estadoInicial = metodo_pago === 'mercadopago' ? 'pendiente' : 'confirmada';

    const [resultado] = await conn.query(
      `INSERT INTO reservas (usuario_id, cancha_id, franja_id, fecha, monto_total, metodo_pago, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuario_id, cancha_id, franja_id, fecha, monto_total, metodo_pago, estadoInicial]
    );

    const reservaId = resultado.insertId;

    await conn.commit();

    // La transacción terminó: devolvemos la conexión antes de llamar a un
    // servicio externo (nunca hacemos HTTP con una transacción abierta).
    conn.release();
    conn = null;

    // 5. Si paga con Mercado Pago, generar el link.
    if (metodo_pago === 'mercadopago') {
      try {
        const preference = new Preference(mp);
        const resultadoMp = await preference.create({
          body: {
            items: [{
              title: `Reserva cancha - ${fecha}`,
              quantity: 1,
              unit_price: parseFloat(monto_total),
              currency_id: 'ARS',
            }],
            back_urls: {
              success: `${process.env.FRONTEND_URL}/`,
              failure: `${process.env.FRONTEND_URL}/`,
              pending: `${process.env.FRONTEND_URL}/`,
            },
            // Solo si hay una URL pública configurada (ngrok, producción, etc.).
            ...(process.env.MP_WEBHOOK_URL
              ? { notification_url: process.env.MP_WEBHOOK_URL }
              : {}),
            external_reference: String(reservaId),
          },
        });

        return res.status(201).json({
          mensaje: 'Reserva creada, redirigiendo a Mercado Pago',
          id: reservaId,
          init_point: resultadoMp.init_point,
        });
      } catch (mpError) {
        console.error('Error Mercado Pago:', mpError);
        // Si el pago no se pudo generar, liberamos el turno.
        await query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [reservaId]);
        return res.status(502).json({
          error: 'No se pudo generar el link de pago. La reserva no se completó.',
        });
      }
    }

    res.status(201).json({ mensaje: 'Reserva creada correctamente', id: reservaId });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  } finally {
    if (conn) conn.release();
  }
});

// PATCH /api/reservas/:id/estado  (solo admin)
// El complejo puede confirmar, completar o cancelar una reserva.
router.patch('/:id/estado', authMiddleware, soloAdmin, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const permitidos = ['pendiente', 'confirmada', 'completada', 'cancelada'];

  if (!permitidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const resultado = await query('UPDATE reservas SET estado = ? WHERE id = ?', [estado, id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    res.json({ mensaje: 'Estado actualizado', estado });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
});

// DELETE /api/reservas/:id  (cancelación lógica)
// El dueño puede cancelar la suya; el admin puede cancelar cualquiera.
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const reservas = await query('SELECT usuario_id, estado FROM reservas WHERE id = ?', [id]);

    if (reservas.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reserva = reservas[0];
    const esAdmin = req.user.rol === 'admin';
    const esDuenio = reserva.usuario_id === req.user.id;

    if (!esAdmin && !esDuenio) {
      return res.status(403).json({ error: 'No podés cancelar una reserva que no es tuya' });
    }

    if (reserva.estado === 'completada') {
      return res.status(400).json({ error: 'No se puede cancelar una reserva completada' });
    }

    await query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [id]);
    res.json({ mensaje: 'Reserva cancelada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  }
});

module.exports = router;
