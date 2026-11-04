// Tests de integración de la API.
// Requiere el backend corriendo (npm run dev) y MySQL arriba.
//
// Uso:  node --test test/api.test.js   (o npm test)
//
// Cada test pega contra HTTP real, igual que el frontend.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config();

const HOST = process.env.HOST || 'localhost';
const PORT = Number(process.env.PORT) || 3001;
const FECHA = '2027-06-15';
const FECHA2 = '2027-06-16';

let adminToken = '';
let clienteToken = '';
let clienteId = null;
let reservaId = null;

function request(method, path, { token, body, raw } = {}) {
  return new Promise((resolve, reject) => {
    const data = raw !== undefined ? raw : body ? JSON.stringify(body) : null;

    const headers = {};
    if (data !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request(
      { hostname: HOST, port: PORT, path, method, headers, agent: false },
      (res) => {
        let texto = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { texto += chunk; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = texto ? JSON.parse(texto) : null; } catch { parsed = texto; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (data !== null) req.write(data);
    req.end();
  });
}

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, `login de ${email} debería ser 200`);
  return res.body;
}

function dbConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'canchas_db',
  });
}

// Inserta directo en la base un turno para hoy. Se usa para probar la regla de
// cancelación sin depender de la hora a la que se corran los tests.
async function insertarReservaDeHoy(usuarioId) {
  const conn = await dbConnection();
  try {
    const [franjas] = await conn.query(
      'SELECT id FROM franjas_horarias WHERE cancha_id = 1 ORDER BY hora_inicio LIMIT 1'
    );
    const [ins] = await conn.query(
      `INSERT INTO reservas (usuario_id, cancha_id, franja_id, fecha, monto_total, metodo_pago, estado)
       VALUES (?, 1, ?, CURDATE(), 1000, 'efectivo', 'confirmada')`,
      [usuarioId, franjas[0].id]
    );
    return ins.insertId;
  } finally {
    await conn.end();
  }
}

async function borrarReserva(id) {
  const conn = await dbConnection();
  try {
    await conn.query('DELETE FROM reservas WHERE id = ?', [id]);
  } finally {
    await conn.end();
  }
}

before(async () => {
  const admin = await login('admin@canchas.com', 'Admin1234');
  adminToken = admin.token;

  const cliente = await login('cliente@test.com', 'Cliente1234');
  clienteToken = cliente.token;
  clienteId = cliente.usuario.id;
});

after(async () => {
  // Limpia las reservas de prueba para no ensuciar la base.
  const conn = await dbConnection();
  await conn.query('DELETE FROM reservas WHERE fecha IN (?, ?)', [FECHA, FECHA2]);
  await conn.end();
});

test('GET /api/canchas es público', async () => {
  const r = await request('GET', '/api/canchas');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body) && r.body.length > 0);
});

test('GET /api/reservas sin token da 401', async () => {
  const r = await request('GET', '/api/reservas');
  assert.equal(r.status, 401);
});

test('GET /api/reservas con token inválido da 401', async () => {
  const r = await request('GET', '/api/reservas', { token: 'token.falso.aca' });
  assert.equal(r.status, 401);
});

test('GET /api/usuarios con cliente da 403', async () => {
  const r = await request('GET', '/api/usuarios', { token: clienteToken });
  assert.equal(r.status, 403);
});

test('GET /api/usuarios con admin da 200', async () => {
  const r = await request('GET', '/api/usuarios', { token: adminToken });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
});

test('GET /api/reservas?fecha inválida da 400', async () => {
  const r = await request('GET', '/api/reservas?fecha=hola', { token: adminToken });
  assert.equal(r.status, 400);
});

test('POST /api/reservas sin datos da 400', async () => {
  const r = await request('POST', '/api/reservas', { token: clienteToken, body: {} });
  assert.equal(r.status, 400);
});

test('POST /api/reservas con método de pago inválido da 400', async () => {
  const r = await request('POST', '/api/reservas', {
    token: clienteToken,
    body: { cancha_id: 1, franja_id: 1, fecha: FECHA, metodo_pago: 'bitcoin' },
  });
  assert.equal(r.status, 400);
});

test('POST /api/reservas con franja de otra cancha da 400', async () => {
  const r = await request('POST', '/api/reservas', {
    token: clienteToken,
    body: { cancha_id: 1, franja_id: 5, fecha: FECHA, metodo_pago: 'efectivo' },
  });
  assert.equal(r.status, 400);
});

test('POST /api/reservas crea la reserva (201)', async () => {
  const r = await request('POST', '/api/reservas', {
    token: clienteToken,
    body: { cancha_id: 1, franja_id: 1, fecha: FECHA, metodo_pago: 'efectivo' },
  });
  assert.equal(r.status, 201);
  assert.ok(r.body.id);
  reservaId = r.body.id;
});

test('POST /api/reservas al mismo turno da 409', async () => {
  const r = await request('POST', '/api/reservas', {
    token: adminToken,
    body: { cancha_id: 1, franja_id: 1, fecha: FECHA, metodo_pago: 'efectivo' },
  });
  assert.equal(r.status, 409);
});

test('una reserva lejana se puede cancelar (puede_cancelar)', async () => {
  const lista = await request('GET', `/api/reservas?fecha=${FECHA}`, { token: clienteToken });
  const creada = lista.body.find((x) => x.id === reservaId);
  assert.equal(creada.puede_cancelar, true);
});

test('PATCH estado con cliente da 403', async () => {
  const r = await request('PATCH', `/api/reservas/${reservaId}/estado`, {
    token: clienteToken,
    body: { estado: 'completada' },
  });
  assert.equal(r.status, 403);
});

test('PATCH estado inválido con admin da 400', async () => {
  const r = await request('PATCH', `/api/reservas/${reservaId}/estado`, {
    token: adminToken,
    body: { estado: 'volando' },
  });
  assert.equal(r.status, 400);
});

test('PATCH estado válido con admin da 200', async () => {
  const r = await request('PATCH', `/api/reservas/${reservaId}/estado`, {
    token: adminToken,
    body: { estado: 'completada' },
  });
  assert.equal(r.status, 200);
});

test('no se puede cancelar una reserva completada', async () => {
  const r = await request('DELETE', `/api/reservas/${reservaId}`, { token: adminToken });
  assert.equal(r.status, 400);

  const lista = await request('GET', `/api/reservas?fecha=${FECHA}`, { token: clienteToken });
  const creada = lista.body.find((x) => x.id === reservaId);
  assert.equal(creada.puede_cancelar, false);
});

test('el cliente no puede cancelar con menos de 24 h', async () => {
  const id = await insertarReservaDeHoy(clienteId);

  try {
    const r = await request('DELETE', `/api/reservas/${id}`, { token: clienteToken });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /cancelar hasta/);
  } finally {
    await borrarReserva(id);
  }
});

test('el admin puede cancelar con menos de 24 h', async () => {
  const id = await insertarReservaDeHoy(clienteId);

  try {
    const r = await request('DELETE', `/api/reservas/${id}`, { token: adminToken });
    assert.equal(r.status, 200);
  } finally {
    await borrarReserva(id);
  }
});

test('GET /api/franjas/:id devuelve precio_vigente y marca nocturnas', async () => {
  const r = await request('GET', '/api/franjas/1');
  assert.equal(r.status, 200);

  const nocturna = r.body.find((f) => f.hora_inicio === '20:00:00');
  const diurna = r.body.find((f) => f.hora_inicio === '18:00:00');

  assert.ok(nocturna && diurna);
  assert.equal(nocturna.es_nocturna, true);
  assert.equal(nocturna.precio_vigente, Number(nocturna.precio_nocturno));
  assert.equal(diurna.es_nocturna, false);
  assert.equal(diurna.precio_vigente, Number(diurna.precio_base));
});

test('una reserva nocturna cobra el precio nocturno', async () => {
  const franjas = await request('GET', '/api/franjas/1');
  const nocturna = franjas.body.find((f) => f.hora_inicio === '20:00:00');

  const r = await request('POST', '/api/reservas', {
    token: clienteToken,
    body: { cancha_id: 1, franja_id: nocturna.id, fecha: FECHA2, metodo_pago: 'efectivo' },
  });
  assert.equal(r.status, 201);

  const lista = await request('GET', `/api/reservas?fecha=${FECHA2}`, { token: adminToken });
  const creada = lista.body.find((x) => x.id === r.body.id);
  assert.equal(Number(creada.monto_total), nocturna.precio_vigente);
});

test('una reserva diurna cobra el precio base', async () => {
  const franjas = await request('GET', '/api/franjas/1');
  const diurna = franjas.body.find((f) => f.hora_inicio === '18:00:00');

  const r = await request('POST', '/api/reservas', {
    token: clienteToken,
    body: { cancha_id: 1, franja_id: diurna.id, fecha: FECHA2, metodo_pago: 'efectivo' },
  });
  assert.equal(r.status, 201);

  const lista = await request('GET', `/api/reservas?fecha=${FECHA2}`, { token: adminToken });
  const creada = lista.body.find((x) => x.id === r.body.id);
  assert.equal(Number(creada.monto_total), Number(diurna.precio_base));
});

test('ruta inexistente responde JSON 404', async () => {
  const r = await request('GET', '/api/no-existe');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'Ruta no encontrada');
});

test('JSON malformado responde JSON 400', async () => {
  const r = await request('POST', '/api/auth/login', { raw: '{bad json' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'JSON inválido');
});
