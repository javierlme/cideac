/**
 * @file routers/utils.js
 * @description Utilidades compartidas para los routers, principalmente para
 * la gestión de tokens JWT y la ofuscación de datos sensibles.
 */
const config = require('../config.js');
const jwt = require('jsonwebtoken');
const tokenTTL = process.env.TOKEN_TTL || 60 * 24 * 7;//Una semana

/**
 * @function signToken
 * @description Firma un payload y genera un token JWT con una fecha de expiración.
 * @param {Object} payload - El contenido a incluir en el token.
 * @returns {{expiration: Date, token: string}} - Un objeto con la fecha de expiración y el token firmado.
 */
const signToken = (payload) => {
  const expiration = new Date(Date.now() + (tokenTTL || 7) * 60000);
  return { expiration, token: jwt.sign({ ...payload, expiration }, config.serverSecret) };
}

/**
 * @function obfuscateString
 * @description Ofusca un string (DNI, NIE, pasaporte u otro) para proteger la privacidad.
 * - DNI/NIE: Muestra los dígitos en las posiciones 4 a 7. Ej: *****1234*
 * - Pasaporte: Muestra los últimos 4 dígitos. Ej: ******5678
 * - Otros: Muestra los últimos 4 caracteres. Ej: ******abcd
 * @param {string} str - El string a ofuscar.
 * @returns {string} - El string ofuscado.
 */
function obfuscateString(str) {
  if (!str) return '';

  const passportRegex = /^[A-Za-z]+\d+/;
  const dniRegex = /^[XYZ]?\d{7,8}[A-Za-z]$/;

  const obfuscateAll = (len) => '*'.repeat(len);

  const obfuscateGeneric = (s) => {
    if (s.length <= 4) return s;
    return '*'.repeat(s.length - 4) + s.slice(-4);
  };

  const obfuscatePassport = (s) => {
    const lastFourRe = /(\d{4})(?!.*\d)/;
    const match = lastFourRe.exec(s);
    if (match) {
      const lastFour = match[1];
      const idx = s.lastIndexOf(lastFour);
      return s.split('').map((ch, i) => (i >= idx && i < idx + 4 ? ch : '*')).join('');
    }
    return obfuscateAll(s.length);
  };

  const obfuscateDniNie = (s) => s.split('').map((ch, i) => (i >= 3 && i <= 6 ? ch : '*')).join('');

  if (passportRegex.test(str)) return obfuscatePassport(str);
  if (dniRegex.test(str)) return obfuscateDniNie(str);
  return obfuscateGeneric(str);
}

/**
 * NOTAS:
 * - tokenTTL: valor en minutos. Por defecto es 60 * 24 * 7 (una semana en minutos).
 * - signToken: genera un objeto { expiration: Date, token: string } y firma el payload
 *   incluyendo la propiedad `expiration` (como objeto Date). Si se prefiere, puede
 *   almacenarse como timestamp numérico para facilitar comprobaciones.
 * - obfuscateString: reglas aplicadas:
 *     • Pasaporte (comienza con letras y contiene números): muestra los últimos 4
 *       dígitos encontrados; si no hay 4 dígitos, se ofusca toda la cadena.
 *     • DNI/NIE (formato español): muestra los caracteres en posiciones 4 a 7
 *       (índices 3..6) y ofusca el resto.
 *     • Otros: muestra los últimos 4 caracteres; si la cadena tiene <= 4 caracteres
 *       se devuelve tal cual.
 * - Consideraciones de seguridad: los tokens firmados incluyen la fecha de
 *   expiración en el payload; valida la expiración en cada petición protegida.
 *
 * Parche local en node_modules:
 * - La corrección aplicada en `node_modules/deepmerge/dist/cjs.js` reemplaza
 *   llamadas inseguras como `target.propertyIsEnumerable(symbol)` por
 *   `Object.prototype.propertyIsEnumerable.call(target, symbol)` para evitar
 *   TypeError cuando el objeto no tiene prototipo o `propertyIsEnumerable` no
 *   es una función.
 *
 * Recomendaciones:
 * 1) Intenta actualizar la dependencia afectada: actualiza `deepmerge` o
 *    `snowpack` (si lo incorpora) a una versión que incluya la corrección.
 * 2) Si no es posible actualizar en este momento, aplica el mismo cambio en el
 *    paquete dentro de `node_modules` como parche temporal antes de desplegar.
 * 3) Reinstala dependencias para asegurar coherencia (elimina `node_modules` y
 *    ejecuta `npm install` o el gestor que uses) y reinicia la aplicación para
 *    verificar que el error se ha resuelto.
 *
 * Si el error persiste, adjunta la versión exacta de `deepmerge` encontrada en
 * tu `package-lock.json` o `yarn.lock` (líneas con la versión) y revisaré la
 * acción precisa a tomar.
 */

module.exports = {
  signToken,
  obfuscateString,
};