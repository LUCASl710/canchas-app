require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});