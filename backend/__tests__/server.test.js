/**
 * @file __tests__/server.test.js
 * @description Tests de integración del servidor Express.
 * Cubre: healthcheck, CORS, autenticación JWT (login, refreshToken),
 * validaciones de entrada para /assign y /slots, endpoints de archivos,
 * categorías y checkSlots.
 */
const request = require('supertest');
const app = require('../server');
const crypto = require('crypto');

describe('Server - Rutas básicas', () => {
  it('debería responder 200 en la ruta raíz /', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('Servidor OK!');
  });

  it('debería devolver 401 en rutas protegidas sin token', async () => {
    const response = await request(app).get('/courses/categories');
    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('ERR_NOT_AUTHORIZED');
  });

  it('debería manejar CORS correctamente', async () => {
    const response = await request(app).options('/');
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-methods']).toContain('PUT');
    expect(response.headers['access-control-allow-methods']).toContain('DELETE');
    expect(response.statusCode).toBe(200);
  });

  it('debería devolver 401 con token inválido', async () => {
    const response = await request(app)
      .get('/courses/categories')
      .set('x-access-token', 'invalid-token-here');
    expect(response.statusCode).toBe(401);
  });
});

describe('Server - Login (/users/login)', () => {
  it('debería devolver 400 si faltan parámetros email y pwd', async () => {
    const response = await request(app)
      .post('/users/login')
      .send({});
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('ERR_MISSING_PARAMS');
    expect(response.body.additionalInfo.params).toContain('email');
    expect(response.body.additionalInfo.params).toContain('pwd');
  });

  it('debería devolver 400 si falta el email', async () => {
    const response = await request(app)
      .post('/users/login')
      .send({ pwd: 'password123' });
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('ERR_MISSING_PARAMS');
    expect(response.body.additionalInfo.params).toContain('email');
  });

  it('debería devolver 400 si falta el pwd', async () => {
    const response = await request(app)
      .post('/users/login')
      .send({ email: 'test@test.com' });
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('ERR_MISSING_PARAMS');
    expect(response.body.additionalInfo.params).toContain('pwd');
  });

  it('debería devolver 400 con credenciales incorrectas', async () => {
    const response = await request(app)
      .post('/users/login')
      .send({ email: 'wrong@test.com', pwd: 'wrongpassword' });
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('ERR_INVALID_LOGIN');
  });

  it('debería devolver 400 con email correcto pero contraseña incorrecta', async () => {
    const response = await request(app)
      .post('/users/login')
      .send({ email: 'ceuta@test.com', pwd: 'wrongpassword' });
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('ERR_INVALID_LOGIN');
  });

  it('el endpoint /users/login debería ser accesible sin token (endpoint abierto)', async () => {
    const response = await request(app)
      .post('/users/login')
      .send({ email: 'test', pwd: 'test' });
    // Debería devolver 400 (error de login), NO 401 (no autorizado)
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('ERR_INVALID_LOGIN');
  });
});

describe('Server - Rutas protegidas', () => {
  let validToken;

  // Helper para obtener un token válido (necesita un usuario real en users.json)
  // Como los passwords están hasheados, creamos un mock de login exitoso
  beforeAll(async () => {
    // Intentar login con las credenciales de test conocidas
    // El hash SHA-512 de la contraseña está en users.json
    // Intentamos obtener un token real - si falla, usamos mock
    const { signToken } = require('../routers/utils');
    const payload = { email: 'ceuta@test.com', permissions: ['admin'] };
    const result = signToken(payload);
    validToken = result.token;
  });

  it('debería acceder a /courses/categories con token válido', async () => {
    const response = await request(app)
      .get('/courses/categories')
      .set('x-access-token', validToken);
    expect(response.statusCode).toBe(200);
    expect(response.body.result).toBeDefined();
    expect(Array.isArray(response.body.result)).toBe(true);
    expect(response.body.result.length).toBe(17);
  });

  it('cada categoría devuelta debe tener name, code, city y type', async () => {
    const response = await request(app)
      .get('/courses/categories')
      .set('x-access-token', validToken);
    response.body.result.forEach(cat => {
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('code');
      expect(cat).toHaveProperty('city');
      expect(cat).toHaveProperty('type');
    });
  });

  describe('checkSlots', () => {
    it('debería devolver 400 si no se pasa city', async () => {
      const response = await request(app)
        .get('/courses/checkSlots')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(400);
    });

    it('debería comprobar si existen slots para Ceuta', async () => {
      const response = await request(app)
        .get('/courses/checkSlots?city=Ceuta')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(200);
      expect(typeof response.body.result).toBe('boolean');
    });

    it('debería comprobar si existen slots para Melilla', async () => {
      const response = await request(app)
        .get('/courses/checkSlots?city=Melilla')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(200);
      expect(typeof response.body.result).toBe('boolean');
    });

    it('debería comprobar si existen slots para CIDEAD', async () => {
      const response = await request(app)
        .get('/courses/checkSlots?city=CIDEAD')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(200);
      expect(typeof response.body.result).toBe('boolean');
    });
  });

  describe('refreshToken', () => {
    it('debería renovar el token con un token admin válido', async () => {
      const response = await request(app)
        .post('/users/refreshToken')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.result.token).toBeDefined();
      expect(response.body.result.expiration).toBeDefined();
      expect(response.body.result.user).toBeDefined();
    });

    it('debería devolver 401 sin token', async () => {
      const response = await request(app)
        .post('/users/refreshToken');
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Assign - validaciones de entrada', () => {
    it('debería devolver 400 si no se envía archivo', async () => {
      const response = await request(app)
        .post('/courses/assign')
        .set('x-access-token', validToken)
        .field('city', 'Ceuta')
        .field('category', 'GB');
      expect(response.statusCode).toBe(400);
    });

    it('debería devolver 400 si no se envía city', async () => {
      const response = await request(app)
        .post('/courses/assign')
        .set('x-access-token', validToken)
        .attach('file', Buffer.from('test'), { filename: 'test.xlsx' })
        .field('category', 'GB');
      expect(response.statusCode).toBe(400);
    });

    it('debería devolver 400 si city es inválida', async () => {
      const response = await request(app)
        .post('/courses/assign')
        .set('x-access-token', validToken)
        .attach('file', Buffer.from('test'), { filename: 'test.xlsx' })
        .field('city', 'InvalidCity')
        .field('category', 'GB');
      expect(response.statusCode).toBe(400);
    });

    it('debería devolver 400 si el fichero no es excel', async () => {
      const response = await request(app)
        .post('/courses/assign')
        .set('x-access-token', validToken)
        .attach('file', Buffer.from('test'), { filename: 'test.txt' })
        .field('city', 'Ceuta')
        .field('category', 'GB');
      expect(response.statusCode).toBe(400);
    });

    it('debería devolver 400 con categoría inválida', async () => {
      const response = await request(app)
        .post('/courses/assign')
        .set('x-access-token', validToken)
        .attach('file', Buffer.from('test'), { filename: 'test.xlsx' })
        .field('city', 'Ceuta')
        .field('category', 'INVALID');
      // Si pasa validaciones de file/city, error en category o en procesamiento
      expect([400, 500]).toContain(response.statusCode);
    });
  });

  describe('Slots - validaciones de entrada', () => {
    it('debería devolver 400 si no se envía archivo', async () => {
      const response = await request(app)
        .post('/courses/slots')
        .set('x-access-token', validToken)
        .field('city', 'Ceuta');
      expect(response.statusCode).toBe(400);
    });

    it('debería devolver 400 si no se envía city', async () => {
      const response = await request(app)
        .post('/courses/slots')
        .set('x-access-token', validToken)
        .attach('file', Buffer.from('test'), { filename: 'test.xlsx' });
      expect(response.statusCode).toBe(400);
    });

    it('debería devolver 400 si city es inválida', async () => {
      const response = await request(app)
        .post('/courses/slots')
        .set('x-access-token', validToken)
        .attach('file', Buffer.from('test'), { filename: 'test.xlsx' })
        .field('city', 'Madrid');
      expect(response.statusCode).toBe(400);
    });

    it('debería devolver 400 si el archivo no es excel', async () => {
      const response = await request(app)
        .post('/courses/slots')
        .set('x-access-token', validToken)
        .attach('file', Buffer.from('test'), { filename: 'test.pdf' })
        .field('city', 'Ceuta');
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Files endpoints', () => {
    it('debería devolver error al intentar leer un archivo slots inexistente', async () => {
      const response = await request(app)
        .get('/courses/files/slots/nonexistent.xls')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(500);
    });

    it('debería devolver error al intentar leer un archivo pdf inexistente', async () => {
      const response = await request(app)
        .get('/courses/files/pdf/nonexistent.pdf')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(500);
    });

    it('debería devolver error al intentar leer un archivo excel inexistente', async () => {
      const response = await request(app)
        .get('/courses/files/excel/nonexistent.xlsx')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(500);
    });

    it('debería devolver error al intentar leer un archivo xlsx inexistente', async () => {
      const response = await request(app)
        .get('/courses/files/xlsx/nonexistent.xlsx')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(500);
    });
  });
});

// Teardown: cerrar el servidor si fue arrancado durante los tests
afterAll(async () => {
  if (app && app.closeServer) {
    await new Promise(resolve => app.closeServer(resolve));
  }
});
