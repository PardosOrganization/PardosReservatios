export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role']
    if (!userRole) {
      return res.status(401).json({ error: 'Falta el rol de usuario en la petición' })
    }
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' })
    }
    next()
  }
}
