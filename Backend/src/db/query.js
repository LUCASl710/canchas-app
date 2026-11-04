const pool = require('./connection');

// Con mysql2/promise, pool.query() resuelve a [filas, campos].
// Devolvemos solo las filas para que las rutas no tengan que cambiar.
const query = async (sql, params = []) => {
  const [filas] = await pool.query(sql, params);
  return filas;
};

module.exports = query;