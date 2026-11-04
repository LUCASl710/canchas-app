const rateLimit = require('express-rate-limit');

// Frena la fuerza bruta en login y registro: N intentos por IP cada X minutos.
// Se puede ajustar por .env (útil para tests o para producción detrás de proxy).
const limitadorAuth = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá unos minutos y volvé a probar.' },
});

module.exports = { limitadorAuth };
