// Crea o actualiza un usuario admin.
//
// Uso (desde Backend/):
//   1. Agregá ADMIN_EMAIL y ADMIN_PASSWORD al .env (mínimo 8 caracteres).
//   2. npm run crear-admin
//
// En producción sirve para no dejar la contraseña demo del seed.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const query = require('../src/db/query');
const pool = require('../src/db/connection');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const nombre = (process.env.ADMIN_NOMBRE || 'Admin').trim();
  const apellido = (process.env.ADMIN_APELLIDO || 'Complejo').trim();

  if (!email || !password || password.length < 8) {
    console.error('Definí ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 8 caracteres).');
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const existentes = await query('SELECT id FROM usuarios WHERE email = ?', [email]);

  if (existentes.length > 0) {
    await query(
      "UPDATE usuarios SET password_hash = ?, rol = 'admin', activo = 1 WHERE id = ?",
      [hash, existentes[0].id]
    );
    console.log(`Admin actualizado: ${email}`);
  } else {
    await query(
      "INSERT INTO usuarios (nombre, apellido, email, password_hash, rol) VALUES (?, ?, ?, ?, 'admin')",
      [nombre, apellido, email, hash]
    );
    console.log(`Admin creado: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
