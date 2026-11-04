const mysql = require('mysql2/promise');

// Pool de conexiones: el servidor mantiene varias abiertas y le presta
// una a cada consulta. Mucho mejor que una sola conexión compartida.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'canchas_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Probamos la conexión al arrancar para enterarnos temprano si algo falla.
pool.query('SELECT 1')
  .then(() => console.log('Conectado a MySQL correctamente'))
  .catch((err) => console.error('Error conectando a la base de datos:', err.message));

module.exports = pool;