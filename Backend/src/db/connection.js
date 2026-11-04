const fs = require('fs');
const mysql = require('mysql2/promise');

// SSL opcional para bases gestionadas (Aiven, Railway público, etc.).
// DB_SSL=true verifica el certificado con las CAs del sistema.
// Si el proveedor te da un ca.pem, pasá la ruta en DB_SSL_CA.
let ssl;
if (process.env.DB_SSL === 'true') {
  ssl = { rejectUnauthorized: true };
  if (process.env.DB_SSL_CA) {
    ssl.ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
  }
}

// Pool de conexiones: el servidor mantiene varias abiertas y le presta
// una a cada consulta. Mucho mejor que una sola conexión compartida.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'canchas_db',
  ssl,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
  queueLimit: 0,
  // Las columnas DATE llegan como "YYYY-MM-DD" (string) y no como Date,
  // así el frontend no las corre un día por la zona horaria.
  dateStrings: ['DATE'],
});

// Probamos la conexión al arrancar para enterarnos temprano si algo falla.
pool.query('SELECT 1')
  .then(() => console.log('Conectado a MySQL correctamente'))
  .catch((err) => console.error('Error conectando a la base de datos:', err.message));

module.exports = pool;
