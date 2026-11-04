require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

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

app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

// Videos subidos por el admin.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});