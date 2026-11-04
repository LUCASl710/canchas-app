const express = require('express');
const router = express.Router();
const { Payment } = require('mercadopago');
const query = require('../db/query');
const mp = require('../config/mercadopago');

// POST /api/pagos/webhook
// Mercado Pago avisa acá cuando cambia el estado de un pago.
// No confiamos en el body: consultamos el pago a la API de MP, que es la
// fuente de verdad. Así, aunque alguien llame al endpoint, no puede inventar
// un pago aprobado.
router.post('/webhook', async (req, res) => {
  const tipo = req.body?.type || req.body?.topic || req.query.type || req.query.topic;
  const pagoId = req.body?.data?.id || req.query['data.id'] || req.query.id;

  // Ignoramos eventos que no sean de pago (merchant_order, etc.).
  if (tipo !== 'payment' || !pagoId) {
    return res.sendStatus(200);
  }

  try {
    const pago = await new Payment(mp).get({ id: pagoId });

    // Solo nos interesa un pago aprobado.
    if (pago.status !== 'approved') {
      return res.sendStatus(200);
    }

    const reservaId = Number(pago.external_reference);
    if (!reservaId) {
      return res.sendStatus(200);
    }

    // Verificamos que la reserva exista y que el monto coincida.
    const reservas = await query('SELECT monto_total FROM reservas WHERE id = ?', [reservaId]);
    if (reservas.length === 0) {
      return res.sendStatus(200);
    }

    const montoEsperado = Number(reservas[0].monto_total);
    const montoPagado = Number(pago.transaction_amount);
    if (montoEsperado !== montoPagado) {
      console.error(
        `Pago ${pagoId}: el monto ${montoPagado} no coincide con la reserva ${reservaId} (${montoEsperado})`
      );
      return res.sendStatus(200);
    }

    // Confirmamos solo si seguía pendiente (idempotente: MP puede reintentar).
    await query(
      "UPDATE reservas SET estado = 'confirmada' WHERE id = ? AND estado = 'pendiente'",
      [reservaId]
    );

    res.sendStatus(200);
  } catch (err) {
    // Un pago inexistente no debe hacer reintentar a Mercado Pago.
    if (err && (err.status === 404 || err.statusCode === 404)) {
      return res.sendStatus(200);
    }
    console.error('Error en webhook de Mercado Pago:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
