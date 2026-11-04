require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./src/db/connection');
const uploadsDir = require('./src/config/uploads');

const app = express();

app.disable('x-powered-by');

// Detrás de un proxy (Railway, Render, Nginx) hay que confiar en el primer
// salto para que req.ip sea la IP real del cliente y no la del proxy.
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Headers de seguridad. cross-origin para que el frontend pueda embeber
// los videos servidos desde /uploads.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const usuariosRouter = require('./src/routes/usuarios');
const canchasRouter = require('./src/routes/canchas');
const franjasRouter = require('./src/routes/franjas');
const reservasRouter = require('./src/routes/reservas');
const authRouter = require('./src/routes/auth');
const grabacionesRouter = require('./src/routes/grabaciones');
const pagosRouter = require('./src/routes/pagos');

const PORT = process.env.PORT || 3001;

// Uno o varios orígenes separados por coma (prod + previews de Vercel).
const origenesPermitidos = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    // Sin Origin (curl, health checks, server-to-server) se permite.
    callback(null, !origin || origenesPermitidos.includes(origin));
  },
}));

// Videos subidos por el admin (UPLOADS_DIR permite usar un volumen).
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Base de datos no disponible' });
  }
});
app.use('/api/usuarios', usuariosRouter);
app.use('/api/canchas', canchasRouter);
app.use('/api/franjas', franjasRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/auth', authRouter);
app.use('/api/grabaciones', grabacionesRouter);
app.use('/api/pagos', pagosRouter);
app.get('/', (req, res) => {
  res.json({ mensaje: 'Servidor de Canchas App funcionando' });
});

// Cualquier ruta que no exista responde JSON (y no el HTML de error de Express).
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Errores no controlados (JSON malformado, body demasiado grande, etc.)
// también responden JSON y no el HTML por defecto de Express.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El contenido enviado es demasiado grande' });
  }

  console.error(err);
  res.status(err.status || err.statusCode || 500).json({ error: 'Error en el servidor' });
});

const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Cierre ordenado: la plataforma manda SIGTERM al reiniciar o hacer deploy.
function cerrar(senal) {
  console.log(`${senal} recibida, cerrando servidor...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  // Si alguna conexión queda colgada, no esperamos para siempre.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => cerrar('SIGTERM'));
process.on('SIGINT', () => cerrar('SIGINT'));