const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const query = require('../db/query');

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const resultados = await query('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (resultados.length === 0) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const usuario = resultados[0];

    const passwordCorrecta = bcrypt.compareSync(password, usuario.password_hash);
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
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  const { nombre, apellido, email, telefono, password } = req.body;

  try {
    const existentes = await query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    const resultado = await query(
      'INSERT INTO usuarios (nombre, apellido, email, telefono, password_hash) VALUES (?, ?, ?, ?, ?)',
      [nombre, apellido, email, telefono, password_hash]
    );

    res.status(201).json({ mensaje: 'Usuario registrado correctamente', id: resultado.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

module.exports = router;
