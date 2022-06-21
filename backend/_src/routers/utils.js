const config = require('../config.js');
const jwt = require('jsonwebtoken');
const tokenTTL = process.env.TOKEN_TTL || 60 * 24 * 7;//Una semana

const signToken = (payload) => {
  const expiration = new Date(new Date().getTime() + (tokenTTL || 7) * 60000);
  return { expiration, token: jwt.sign({ ...payload, expiration }, config.serverSecret) };
}

module.exports = {
  signToken,
};