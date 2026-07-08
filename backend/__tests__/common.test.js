/**
 * @file __tests__/common.test.js
 * @description Tests unitarios para las funciones de respuesta y manejo de errores (common.js).
 * Verifica respond, handleControlledError y handleException con mocks de req/res.
 */
const { respond, handleControlledError, handleException } = require('../common');

describe('Common - respond', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      jsonp: jest.fn().mockReturnThis(),
    };
  });

  it('debería responder con el código HTTP y body correctos', () => {
    respond(mockReq, mockRes, 200, { result: 'ok' });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.jsonp).toHaveBeenCalledWith({ result: 'ok' });
  });

  it('debería responder con código 400', () => {
    respond(mockReq, mockRes, 400, { code: 'ERR_TEST' });
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.jsonp).toHaveBeenCalledWith({ code: 'ERR_TEST' });
  });

  it('debería responder con código 500', () => {
    respond(mockReq, mockRes, 500, { code: 'UNKNOWN' });
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});

describe('Common - handleControlledError', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = { body: { transactionId: 'tx-123' } };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      jsonp: jest.fn().mockReturnThis(),
    };
  });

  it('debería manejar error controlado con httpCode y código', () => {
    const err = {
      httpCode: 400,
      code: 'ERR_CUSTOM',
      additionalInfo: { desc: 'test error' }
    };
    handleControlledError(mockReq, mockRes, err);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.jsonp).toHaveBeenCalledWith({
      code: 'ERR_CUSTOM',
      additionalInfo: { desc: 'test error', transactionId: 'tx-123' }
    });
  });

  it('debería incluir transactionId del body en additionalInfo', () => {
    const err = {
      httpCode: 422,
      code: 'ERR_VALIDATION',
      additionalInfo: {}
    };
    handleControlledError(mockReq, mockRes, err);
    const responseBody = mockRes.jsonp.mock.calls[0][0];
    expect(responseBody.additionalInfo.transactionId).toBe('tx-123');
  });
});

describe('Common - handleException', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = { body: { transactionId: 'tx-456' } };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      jsonp: jest.fn().mockReturnThis(),
      httpSent: false,
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('debería delegar a handleControlledError si el error tiene httpCode', () => {
    const err = {
      httpCode: 400,
      code: 'ERR_CONTROLLED',
      additionalInfo: { desc: 'controlled' }
    };
    handleException(mockReq, mockRes, err);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('debería responder con 500 si el error no tiene httpCode', () => {
    const err = new Error('Unexpected error');
    handleException(mockReq, mockRes, err);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.jsonp).toHaveBeenCalledWith({ code: 'UNKNOWN_EXCEPTION' });
  });

  it('no debería enviar respuesta si ya se envió (httpSent=true)', () => {
    mockRes.httpSent = true;
    const err = new Error('Already sent');
    handleException(mockReq, mockRes, err);
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
