-- ============================================================
--  Canchas App — Datos de prueba (SOLO DESARROLLO)
--  Uso:  mysql -u root < db/seed.sql
--
--  Credenciales de demo:
--    Admin   -> admin@canchas.com   / Admin1234
--    Cliente -> cliente@test.com    / Cliente1234
-- ============================================================

USE canchas_db;

-- Usuarios (los hashes corresponden a las contraseñas de arriba)
INSERT INTO usuarios (id, nombre, apellido, email, telefono, password_hash, rol) VALUES
  (1, 'Admin',  'Complejo', 'admin@canchas.com', '3510000000',
      '$2b$10$h8fOwJCXoY0ztzjDbEmNP.zuQNqvqLD0kWatu2.8ZdWF1XcbG0mfe', 'admin'),
  (2, 'Juan',   'Pérez',    'cliente@test.com',  '3511111111',
      '$2b$10$GgsLbAVlgE54g1DghzADPeIo3VZvNY6cW2Vf3vXTZVAoufP1mz0Na', 'cliente');

-- Canchas
INSERT INTO canchas (id, nombre, tipo, superficie, tiene_techo, tiene_iluminacion) VALUES
  (1, 'Cancha Central', 'futbol5', 'Césped sintético', 0, 1),
  (2, 'Cancha Norte',   'futbol7', 'Césped sintético', 1, 1),
  (3, 'Cancha Sur',     'futbol5', 'Césped sintético', 0, 0);

-- Franjas fijas (3 turnos por cancha)
INSERT INTO franjas_horarias (cancha_id, hora_inicio, hora_fin, precio_base, precio_nocturno) VALUES
  (1, '18:00:00', '19:00:00', 18000.00, 22000.00),
  (1, '19:00:00', '20:00:00', 18000.00, 22000.00),
  (1, '20:00:00', '21:00:00', 22000.00, 26000.00),
  (2, '18:00:00', '19:30:00', 26000.00, 30000.00),
  (2, '19:30:00', '21:00:00', 26000.00, 30000.00),
  (3, '17:00:00', '18:00:00', 15000.00, 18000.00),
  (3, '18:00:00', '19:00:00', 15000.00, 18000.00);
