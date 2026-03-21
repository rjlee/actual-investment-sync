function authorizeHeader(authHeader, expectedToken) {
  if (!expectedToken) return true;
  const auth = (authHeader || '').trim();
  const prefix = 'bearer ';
  const got = auth.toLowerCase().startsWith(prefix) ? auth.slice(prefix.length) : null;
  return got === expectedToken;
}

module.exports = { authorizeHeader };
