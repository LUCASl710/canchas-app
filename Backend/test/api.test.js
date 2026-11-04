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

let adminToken = '';
let clienteToken = '';
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
  return res.body.token;
}

before(async () => {
  adminToken = await login('admin@canchas.com', 'Admin1234');
  clienteToken = await login('cliente@test.com', 'Cliente1234');
});

after(async () => {
  // Limpia las reservas de prueba para no ensuciar la base.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'canchas_db',
  });
  await conn.query('DELETE FROM reservas WHERE fecha = ?', [FECHA]);
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
