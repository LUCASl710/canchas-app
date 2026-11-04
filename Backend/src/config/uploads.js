const path = require('path');
const fs = require('fs');

// En desarrollo los videos quedan en Backend/uploads (gitignoreado).
// En producción se puede apuntar a un volumen persistente con UPLOADS_DIR,
// porque el disco de muchas plataformas es efímero y se borra en cada deploy.
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

module.exports = uploadsDir;
