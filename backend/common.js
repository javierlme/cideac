/**
 * @file common.js
 * @description Funciones compartidas de respuesta HTTP y manejo de errores.
 * Todas las rutas de la API canalizan sus respuestas (éxito y error) a través
 * de estas funciones para garantizar un formato de respuesta uniforme.
 */

/**
 * Envía una respuesta HTTP con el código y cuerpo indicados.
 * @param {Object} req  - Objeto de petición Express (se conserva para trazabilidad futura).
 * @param {Object} res  - Objeto de respuesta Express.
 * @param {number} httpCode - Código de estado HTTP (200, 400, 500…).
 * @param {Object} body - Cuerpo JSON de la respuesta.
 */
function respond(req, res, httpCode, body) {
  // NOTE: Mantenemos req por si en algún momento queremos trazar con datos de la petición
  res.status(httpCode).jsonp(body);
};

/**
 * Gestiona un error controlado (con httpCode definido). Incluye el transactionId
 * del body de la petición en additionalInfo para facilitar la trazabilidad.
 * @param {Object} req - Objeto de petición Express.
 * @param {Object} res - Objeto de respuesta Express.
 * @param {Object} err - Error controlado con { httpCode, code, additionalInfo }.
 */
function handleControlledError(req, res, err) {
  respond(req, res, err.httpCode, { code: err.code, additionalInfo: { ...err.additionalInfo, transactionId: req.body.transactionId } });
};

/**
 * Gestiona cualquier excepción. Si el error tiene httpCode lo trata como
 * controlado; de lo contrario devuelve 500 con código UNKNOWN_EXCEPTION.
 * Protege contra doble respuesta comprobando res.httpSent.
 * @param {Object} req - Objeto de petición Express.
 * @param {Object} res - Objeto de respuesta Express.
 * @param {Object} err - Error capturado (controlado o inesperado).
 */
function handleException(req, res, err) {
  console.error(err);
  if (!res.httpSent) {
    if (err.httpCode) {
      handleControlledError(req, res, err);
    } else {
      respond(req, res, 500, { code: 'UNKNOWN_EXCEPTION' }, err);
    }
  }
};

module.exports = { respond, handleControlledError, handleException };