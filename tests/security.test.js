const { authorizeHeader } = require('../src/security');

describe('security', () => {
  describe('authorizeHeader', () => {
    it('allows request when no token is configured', () => {
      expect(authorizeHeader('Bearer abc123', null)).toBe(true);
      expect(authorizeHeader('', undefined)).toBe(true);
    });

    it('allows request with correct bearer token', () => {
      expect(authorizeHeader('Bearer my-secret-token', 'my-secret-token')).toBe(true);
      expect(authorizeHeader('bearer my-secret-token', 'my-secret-token')).toBe(true);
      expect(authorizeHeader('BEARER my-secret-token', 'my-secret-token')).toBe(true);
    });

    it('rejects request with incorrect bearer token', () => {
      expect(authorizeHeader('Bearer wrong-token', 'my-secret-token')).toBe(false);
      expect(authorizeHeader('Bearer ', 'my-secret-token')).toBe(false);
    });

    it('rejects request without bearer prefix', () => {
      expect(authorizeHeader('my-secret-token', 'my-secret-token')).toBe(false);
      expect(authorizeHeader('Basic abc123', 'my-secret-token')).toBe(false);
    });

    it('handles empty or missing auth header', () => {
      expect(authorizeHeader('', 'my-secret-token')).toBe(false);
      expect(authorizeHeader(null, 'my-secret-token')).toBe(false);
      expect(authorizeHeader(undefined, 'my-secret-token')).toBe(false);
    });
  });
});
