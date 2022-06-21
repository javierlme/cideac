function respond(req, res, httpCode, body) {
  // NOTE: Mantenemos req por si en algún momento queremos trazar con datos de la petición
  res.status(httpCode).jsonp(body);
};

function handleControlledError(req, res, err) {
  respond(req, res, err.httpCode, { code: err.code, additionalInfo: { ...err.additionalInfo, transactionId: req.body.transactionId } });
};

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