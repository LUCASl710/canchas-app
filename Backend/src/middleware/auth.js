const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1]; // formato: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Formato de token inválido' });
  }

  jwt.verify(token, SECRET, (err, usuario) => {
    // 401 = "no estás autenticado" (token vencido o inválido).
    // 403 queda reservado para "estás autenticado pero no tenés permiso".
    if (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    req.user = usuario;
    next();
  });
};

module.exports = authMiddleware;
