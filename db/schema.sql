-- ============================================================
--  Canchas App — Esquema de base de datos
--  Motor: MySQL 8.0+ / MariaDB 10.6+
--  Uso:  mysql -u root < db/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS canchas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE canchas_db;

-- Se borran en orden inverso a las dependencias:
-- primero las hijas (reservas, grabaciones), después las padres.
DROP TABLE IF EXISTS grabaciones;
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS franjas_horarias;
DROP TABLE IF EXISTS canchas;
DROP TABLE IF EXISTS usuarios;

-- ------------------------------------------------------------
--  usuarios
--  Clientes del complejo y administradores.
--  La contraseña NUNCA se guarda en texto plano: solo su hash bcrypt.
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id            INT           NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(100)  NOT NULL,
  apellido      VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL,
  telefono      VARCHAR(20)   NULL,
  password_hash VARCHAR(255)  NOT NULL,
  rol           ENUM('cliente','admin') NOT NULL DEFAULT 'cliente',
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  canchas
--  activa = 0 permite "dar de baja" sin borrar el historial.
-- ------------------------------------------------------------
CREATE TABLE canchas (
  id                INT          NOT NULL AUTO_INCREMENT,
  nombre            VARCHAR(100) NOT NULL,
  tipo              ENUM('futbol5','futbol7') NOT NULL,
  superficie        VARCHAR(50)  NOT NULL,
  tiene_techo       TINYINT(1)   NOT NULL DEFAULT 0,
  tiene_iluminacion TINYINT(1)   NOT NULL DEFAULT 1,
  activa            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  franjas_horarias
--  Turnos fijos de cada cancha (decisión del proyecto: Opción A).
--  CHECK evita cargar una franja que termine antes de empezar.
-- ------------------------------------------------------------
CREATE TABLE franjas_horarias (
  id              INT           NOT NULL AUTO_INCREMENT,
  cancha_id       INT           NOT NULL,
  hora_inicio     TIME          NOT NULL,
  hora_fin        TIME          NOT NULL,
  precio_base     DECIMAL(10,2) NOT NULL,
  precio_nocturno DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_franjas_cancha (cancha_id),
  CONSTRAINT fk_franjas_cancha
    FOREIGN KEY (cancha_id) REFERENCES canchas (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_franjas_horario CHECK (hora_fin > hora_inicio),
  CONSTRAINT chk_franjas_precio  CHECK (precio_base >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  reservas
--  El índice (franja_id, fecha) es el que usa el chequeo de
--  disponibilidad en cada intento de reserva.
--  El índice (fecha) es el que usa el panel del admin.
-- ------------------------------------------------------------
CREATE TABLE reservas (
  id          INT           NOT NULL AUTO_INCREMENT,
  usuario_id  INT           NOT NULL,
  cancha_id   INT           NOT NULL,
  franja_id   INT           NOT NULL,
  fecha       DATE          NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  estado      ENUM('pendiente','confirmada','cancelada','completada')
                            NOT NULL DEFAULT 'pendiente',
  metodo_pago ENUM('mercadopago','efectivo','qr_presencial') NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservas_usuario (usuario_id),
  KEY idx_reservas_cancha (cancha_id),
  KEY idx_reservas_franja_fecha (franja_id, fecha),
  KEY idx_reservas_fecha (fecha),
  CONSTRAINT fk_reservas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservas_cancha
    FOREIGN KEY (cancha_id) REFERENCES canchas (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservas_franja
    FOREIGN KEY (franja_id) REFERENCES franjas_horarias (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_reservas_monto CHECK (monto_total >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  grabaciones
--  Una reserva puede tener 0..N grabaciones.
--  estado arranca en 'procesando': recién cuando el archivo
--  terminó de subirse pasa a 'disponible'.
-- ------------------------------------------------------------
CREATE TABLE grabaciones (
  id                INT          NOT NULL AUTO_INCREMENT,
  reserva_id        INT          NOT NULL,
  titulo            VARCHAR(150) NOT NULL,
  archivo_url       VARCHAR(500) NOT NULL,
  duracion_segundos INT          NULL,
  estado            ENUM('procesando','disponible','error')
                                 NOT NULL DEFAULT 'procesando',
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_grabaciones_reserva (reserva_id),
  CONSTRAINT fk_grabaciones_reserva
    FOREIGN KEY (reserva_id) REFERENCES reservas (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_grabaciones_duracion CHECK (duracion_segundos IS NULL OR duracion_segundos >= 0)
) ENGINE=InnoDB;
