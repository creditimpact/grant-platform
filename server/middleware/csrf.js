function csrfProtection(req, res, next) {
  next();
}
function generateCsrfToken() {
  return '';
}
module.exports = { csrfProtection, generateCsrfToken };
