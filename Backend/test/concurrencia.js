// Prueba de concurrencia: dos clientes reservan el MISMO turno a la vez.
// Debe entrar exactamente una (201) y la otra debe ser rechazada (409).
//
// Uso:  node test/concurrencia.js
// Requiere el backend corriendo en http://localhost:3001

const http = require('http');

const HOST = process.env.HOST || 'localhost';
const PORT = Number(process.env.PORT) || 3001;

function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;

    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request(
      { hostname: HOST, port: PORT, path, method, headers, agent: false },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`Login falló para ${email}: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function main() {
  const [tokenA, tokenB] = await Promise.all([
    login('admin@canchas.com', 'Admin1234'),
    login('cliente@test.com', 'Cliente1234'),
  ]);

  const body = { cancha_id: 1, franja_id: 1, fecha: '2026-12-30', metodo_pago: 'efectivo' };

  // Las dos salen exactamente al mismo tiempo.
  const resultados = await Promise.all([
    request('POST', '/api/reservas', { token: tokenA, body }),
    request('POST', '/api/reservas', { token: tokenB, body }),
  ]);

  const codigos = resultados.map((r) => r.status).sort();
  const ok = codigos[0] === 201 && codigos[1] === 409;

  console.log('Respuestas:', resultados.map((r) => `${r.status} ${JSON.stringify(r.body)}`).join(' | '));

  // Limpieza: si una entró, la cancelamos para poder repetir la prueba.
  const creada = resultados.find((r) => r.status === 201);
  if (creada) {
    await request('DELETE', `/api/reservas/${creada.body.id}`, { token: tokenA });
  }

  if (ok) {
    console.log('OK: una reserva entró y la otra fue rechazada (409).');
    process.exitCode = 0;
    return;
  }

  console.error('FALLA: se permitió doble reserva o hubo un error inesperado.');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
