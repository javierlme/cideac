const config = require('../config.js');
const jwt = require('jsonwebtoken');
const tokenTTL = process.env.TOKEN_TTL || 60 * 24 * 7;//Una semana

const signToken = (payload) => {
  const expiration = new Date(new Date().getTime() + (tokenTTL || 7) * 60000);
  return { expiration, token: jwt.sign({ ...payload, expiration }, config.serverSecret) };
}

function obfuscateString(str) {
  if (!str) return '';

  // Detect if it's a passport (starts with letters, length > 7)
  const passportRegex = /^[A-Za-z]+[0-9]+/;
  if (passportRegex.test(str)) {
    // Ofuscar todos los caracteres excepto los últimos 4 números de la cadena
    const lastFourDigitsMatch = str.match(/(\d{4})(?!.*\d)/);
    if (lastFourDigitsMatch) {
      const lastFourDigits = lastFourDigitsMatch[1];
      // Busca la posición de los últimos 4 dígitos en la cadena
      const lastFourDigitsIndex = str.lastIndexOf(lastFourDigits);
      let result = '';
      for (let i = 0; i < str.length; i++) {
      if (i >= lastFourDigitsIndex && i < lastFourDigitsIndex + 4) {
        result += str[i];
      } else {
        result += '*';
      }
      }
      return result;
    } else {
      // Si no hay 4 dígitos, ofuscar todo
      return '*'.repeat(str.length);
    }
  // Matches Spanish DNI/NIE formats: optional leading X/Y/Z, 7-8 digits, ending with a letter
  } else if (/^[XYZ]?\d{7,8}[A-Za-z]$/.test(str)) {
    // Ofuscar todas las posiciones excepto 4, 5, 6 y 7 (índices 3, 4, 5, 6)
    let result = '';
    for (let i = 0; i < str.length; i++) {
      if (i >= 3 && i <= 6) {
      result += str[i];
      } else {
      result += '*';
      }
    }
    return result;
  }
  else {
    // Si no es DNI, NIE ni pasaporte, ofuscar todo excepto los 4 últimos caracteres
    if (str.length <= 4) {
      return str;
    }
    const visible = str.slice(-4);
    const obfuscated = '*'.repeat(str.length - 4);
    return obfuscated + visible;
  }
}

module.exports = {
  signToken,
  obfuscateString,
};