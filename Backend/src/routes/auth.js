const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const query = require('../db/query');
const { limitadorAuth } = require('../middleware/rateLimit');

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/login
router.post('/login', limitadorAuth, async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password
  ) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const emailNormalizado = email.trim().toLowerCase();
    const resultados = await query('SELECT * FROM usuarios WHERE email = ?', [emailNormalizado]);

    if (resultados.length === 0) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const usuario = resultados[0];

    // Versión async: no bloquea el event loop mientras bcrypt trabaja.
    const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordCorrecta) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // Un usuario dado de baja no puede iniciar sesión.
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/auth/registro
router.post('/registro', limitadorAuth, async (req, res) => {
  const { nombre, apellido, email, telefono, password } = req.body || {};

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof apellido !== 'string' || !apellido.trim() ||
    typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) ||
    typeof password !== 'string' || password.length < 8
  ) {
    return res.status(400).json({
      error: 'Revisá los datos: nombre, apellido, email válido y contraseña de al menos 8 caracteres',
    });
  }

  const emailNormalizado = email.trim().toLowerCase();

  try {
    const existentes = await query('SELECT id FROM usuarios WHERE email = ?', [emailNormalizado]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const resultado = await query(
      'INSERT INTO usuarios (nombre, apellido, email, telefono, password_hash) VALUES (?, ?, ?, ?, ?)',
      [
        nombre.trim(),
        apellido.trim(),
        emailNormalizado,
        telefono ? String(telefono).trim() : null,
        password_hash,
      ]
    );

    res.status(201).json({ mensaje: 'Usuario registrado correctamente', id: resultado.insertId });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

module.exports = router;
