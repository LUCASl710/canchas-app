// Importa db/schema.sql + db/seed.sql a una base MySQL/TiDB.
//
// Uso (desde Backend/):
//   $env:DOTENV_CONFIG_PATH=".env.production"
//   $env:CONFIRMAR_RESET="SI"
//   npm run db:import
//
// OJO: borra y recrea las tablas. Es para la primera puesta en marcha.
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const dbName = process.env.DB_NAME || 'canchas_db';

function leerSql(archivo) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'db', archivo), 'utf8');
}

async function main() {
  if (process.env.CONFIRMAR_RESET !== 'SI') {
    console.error('Este script BORRA y recrea las tablas.');
    console.error('Si estás seguro, ejecutalo con CONFIRMAR_RESET=SI.');
    process.exitCode = 1;
    return;
  }

  let ssl;
  if (process.env.DB_SSL === 'true') {
    ssl = { rejectUnauthorized: true };
    if (process.env.DB_SSL_CA) {
      ssl.ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
    }
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
    multipleStatements: true,
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
    );
    await conn.query(`USE \`${dbName}\``);

    // El schema y el seed traen CREATE DATABASE/USE para el MySQL local;
    // acá ya elegimos la base, así que los sacamos.
    const schema = leerSql('schema.sql')
      .replace(/CREATE DATABASE[\s\S]*?;\s*/i, '')
      .replace(/USE\s+`?canchas_db`?\s*;\s*/i, '');
    const seed = leerSql('seed.sql')
      .replace(/USE\s+`?canchas_db`?\s*;\s*/i, '');

    try {
      await conn.query('SET tidb_enable_check_constraint = ON');
    } catch (err) {
      console.warn('No se pudo habilitar CHECK (sigo igual):', err.message);
    }

    await conn.query(schema);
    await conn.query(seed);

    const [usuarios] = await conn.query('SELECT COUNT(*) AS total FROM usuarios');
    const [canchas] = await conn.query('SELECT COUNT(*) AS total FROM canchas');
    const [franjas] = await conn.query('SELECT COUNT(*) AS total FROM franjas_horarias');

    console.log(
      `Listo: ${usuarios[0].total} usuarios, ${canchas[0].total} canchas, ${franjas[0].total} franjas.`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
