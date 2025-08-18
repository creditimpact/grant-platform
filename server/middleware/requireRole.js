function requireRole(role) {
  return (req, res, next) => next();
}
module.exports = requireRole;
