const config = require('../config');

describe('Config', () => {
  it('debería tener un puerto definido', () => {
    expect(config.expressPort).toBeDefined();
  });

  it('debería usar puerto 8081 por defecto', () => {
    // Si no hay variable de entorno PORT, usa 8081
    if (!process.env.PORT) {
      expect(config.expressPort).toBe(8081);
    }
  });

  it('debería tener un secreto para el servidor', () => {
    expect(config.serverSecret).toBeDefined();
    expect(typeof config.serverSecret).toBe('string');
    expect(config.serverSecret.length).toBeGreaterThan(0);
  });

  it('debería tener un TTL para el token', () => {
    expect(config.tokenTTL).toBeDefined();
    expect(typeof config.tokenTTL).toBe('number');
    expect(config.tokenTTL).toBeGreaterThan(0);
  });

  it('el TTL por defecto debería ser 1 semana en minutos (60*24*7)', () => {
    if (!process.env.TOKEN_TTL) {
      expect(config.tokenTTL).toBe(60 * 24 * 7);
    }
  });
});
