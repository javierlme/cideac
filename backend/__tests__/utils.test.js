/**
 * @file __tests__/utils.test.js
 * @description Tests unitarios para las utilidades compartidas (routers/utils.js).
 * Cubre la ofuscación de documentos de identidad (DNI, NIE, pasaporte, genéricos)
 * y la generación/verificación de tokens JWT.
 */
const { obfuscateString, signToken } = require('../routers/utils');
const jwt = require('jsonwebtoken');
const config = require('../config');

describe('Utils - obfuscateString', () => {

  describe('DNI español (formato 12345678A)', () => {
    it('debería ofuscar un DNI dejando visibles posiciones 3-6', () => {
      const result = obfuscateString('12345678A');
      expect(result).toBe('***4567**');
    });

    it('debería ofuscar un DNI de 8 dígitos + letra', () => {
      const result = obfuscateString('98765432Z');
      expect(result).toBe('***6543**');
    });
  });

  describe('NIE español (formato X1234567A)', () => {
    it('debería ofuscar un NIE con X inicial', () => {
      const result = obfuscateString('X1234567A');
      expect(result).toBe('****4567*');
    });

    it('debería ofuscar un NIE con Y inicial', () => {
      const result = obfuscateString('Y1234567B');
      expect(result).toBe('****4567*');
    });

    it('debería ofuscar un NIE con Z inicial', () => {
      const result = obfuscateString('Z9876543C');
      expect(result).toBe('****6543*');
    });
  });

  describe('Pasaporte (formato letras + dígitos)', () => {
    it('debería ofuscar un pasaporte dejando visibles los últimos 4 dígitos', () => {
      const result = obfuscateString('AB1234567');
      expect(result).toBe('*****4567');
    });

    it('debería ofuscar pasaporte corto', () => {
      const result = obfuscateString('AAA1234');
      expect(result).toBe('***1234');
    });
  });

  describe('Cadenas genéricas', () => {
    it('debería ofuscar cadena genérica dejando últimos 4 caracteres', () => {
      const result = obfuscateString('ABCDEFGH');
      expect(result).toBe('****EFGH');
    });

    it('debería devolver la cadena completa si tiene 4 o menos caracteres', () => {
      expect(obfuscateString('AB')).toBe('AB');
      expect(obfuscateString('ABCD')).toBe('ABCD');
    });

    it('debería devolver cadena vacía si la entrada está vacía', () => {
      expect(obfuscateString('')).toBe('');
    });

    it('debería devolver cadena vacía si la entrada es null/undefined', () => {
      expect(obfuscateString(null)).toBe('');
      expect(obfuscateString(undefined)).toBe('');
    });
  });

  describe('Consistencia de longitud', () => {
    it('la longitud del resultado debe ser igual a la del input para DNI', () => {
      const input = '12345678A';
      expect(obfuscateString(input).length).toBe(input.length);
    });

    it('la longitud del resultado debe ser igual a la del input para NIE', () => {
      const input = 'X1234567A';
      expect(obfuscateString(input).length).toBe(input.length);
    });

    it('la longitud del resultado debe ser igual a la del input para pasaporte', () => {
      const input = 'AB1234567';
      expect(obfuscateString(input).length).toBe(input.length);
    });

    it('la longitud del resultado debe ser igual a la del input para cadenas genéricas', () => {
      const input = 'ABCDEFGH';
      expect(obfuscateString(input).length).toBe(input.length);
    });
  });
});

describe('Utils - signToken', () => {
  it('debería generar un token JWT válido', () => {
    const payload = { email: 'test@test.com', permissions: ['admin'] };
    const { expiration, token } = signToken(payload);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(expiration).toBeInstanceOf(Date);
  });

  it('debería generar un token verificable con el secreto de la configuración', () => {
    const payload = { email: 'test@test.com', permissions: ['admin'] };
    const { token } = signToken(payload);
    const decoded = jwt.verify(token, config.serverSecret);

    expect(decoded.email).toBe('test@test.com');
    expect(decoded.permissions).toEqual(['admin']);
  });

  it('la expiración debería ser posterior al momento actual', () => {
    const payload = { email: 'test@test.com', permissions: ['admin'] };
    const { expiration } = signToken(payload);
    expect(expiration.getTime()).toBeGreaterThan(Date.now());
  });

  it('el token debería contener la expiración en el payload', () => {
    const payload = { email: 'test@test.com', permissions: ['admin'] };
    const { token } = signToken(payload);
    const decoded = jwt.verify(token, config.serverSecret);
    expect(decoded.expiration).toBeDefined();
  });
});
