const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const query = require('../db/query');
const authMiddleware = require('../middleware/auth');
const { soloAdmin } = require('../middleware/roles');
const uploadsDir = require('../config/uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    cb(null, `grabacion-${Date.now()}${extension}`);
  },
});

// En producción conviene bajarlo (Render free corta requests largos y el
// disco es efímero). Se configura por entorno sin tocar el código.
const maxVideoMb = Number(process.env.MAX_VIDEO_MB) || 500;

const upload = multer({
  storage,
  limits: { fileSize: maxVideoMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('El archivo debe ser un video'));
    }
    cb(null, true);
  },
});

// Envuelve multer para devolver JSON en vez del HTML de error de Express.
const subirVideo = (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `El video supera el límite de ${maxVideoMb} MB` });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// GET /api/grabaciones/reserva/:reservaId
// Solo el dueño de la reserva (o un admin) puede ver sus grabaciones.
router.get('/reserva/:reservaId', authMiddleware, async (req, res) => {
  const { reservaId } = req.params;

  try {
    const reservas = await query('SELECT usuario_id FROM reservas WHERE id = ?', [reservaId]);

    if (reservas.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const esDuenio = reservas[0].usuario_id === req.user.id;
    if (!esDuenio && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tenés acceso a esta grabación' });
    }

    const grabaciones = await query(
      "SELECT * FROM grabaciones WHERE reserva_id = ? AND estado = 'disponible'",
      [reservaId]
    );
    res.json(grabaciones);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener grabaciones' });
  }
});

// POST /api/grabaciones  (solo admin)
// Sube un video y lo asocia a una reserva.
router.post('/', authMiddleware, soloAdmin, subirVideo, async (req, res) => {
  const { reserva_id, titulo } = req.body;

  if (!reserva_id || !titulo || !req.file) {
    return res.status(400).json({ error: 'Faltan reserva_id, título o archivo' });
  }

  try {
    const reservas = await query('SELECT id FROM reservas WHERE id = ?', [reserva_id]);
    if (reservas.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const archivo_url = `/uploads/${req.file.filename}`;
    const resultado = await query(
      "INSERT INTO grabaciones (reserva_id, titulo, archivo_url, estado) VALUES (?, ?, ?, 'disponible')",
      [reserva_id, titulo, archivo_url]
    );

    res.status(201).json({
      mensaje: 'Grabación subida correctamente',
      id: resultado.insertId,
      archivo_url,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar la grabación' });
  }
});

module.exports = router;
