// Middleware de autorización por rol.
// Se usa SIEMPRE después de authMiddleware, porque necesita req.user.
const soloAdmin = (req, res, next) => {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'No tenés permisos para hacer esto' });
  }
  next();
};

module.exports = { soloAdmin };
