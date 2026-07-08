/**
 * @file routers/users.js
 * @description Router para la autenticación de usuarios.
 *
 * Endpoints:
 *  - POST /login: Autentica a un usuario y devuelve un token JWT.
 *  - POST /refreshToken: Refresca un token JWT existente.
 *
 * El endpoint /login es público, mientras que /refreshToken requiere un token válido.
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const common = require('../common');
const crypto = require('crypto');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const guard = require('express-jwt-permissions')();

/**
 * @function readUsers
 * @description Lee y parsea el fichero JSON que contiene la información de los usuarios.
 * @returns {Array<Object>} Un array de objetos de usuario.
 */
const readUsers = () => {
  const usersInfo = fs.readFileSync(path.join(__dirname, '..', 'data', 'users.json'), 'utf-8');
  return JSON.parse(usersInfo);
};

/**
 * @function findUser
 * @description Busca un usuario por email y, opcionalmente, por contraseña.
 * @param {string} email - El email del usuario a buscar.
 * @param {string|null} [pwd=null] - La contraseña hasheada del usuario. Si es null, busca solo por email.
 * @returns {Object|undefined} El objeto de usuario si se encuentra, o undefined.
 */
const findUser = (email, pwd = null) => {
  const users = readUsers();
  // TODO: ¿Case insensitive en el email?
  return users.find(u => u.email === email && (pwd == null || u.pwd === pwd));
};

/**
 * @route POST /login
 * @description Autentica a un usuario a partir de su email y contraseña.
 * Si las credenciales son válidas, genera y devuelve un token JWT junto
 * con la información del usuario.
 * @param {string} req.body.email - Email del usuario.
 * @param {string} req.body.pwd - Contraseña del usuario (sin hashear).
 * @returns {Object} 200 OK con el token, su expiración y los datos del usuario.
 */
router.post('/login', async (req, res) => {
  try {
    const missings = ['email', 'pwd'].filter((m) => req.body[m] == null);
    if (missings.length > 0) {
      return common.respond(req, res, 400, {
        code: 'ERR_MISSING_PARAMS',
        additionalInfo: { params: missings },
      });
    }
    const sha512 = crypto.createHash('sha512');
    sha512.update(req.body.pwd);
    const password = sha512.digest('hex');
    let user;
    try {
      user = findUser(req.body.email, password);
    } catch (err) {
      console.error('User file corrupted');
      return common.respond(req, res, 400, { code: 'ERR_INVALID_LOGIN' });
    }
    if (user == null) {
      return common.respond(req, res, 400, { code: 'ERR_INVALID_LOGIN' });
    }
    const payload = {
      email: user.email,
      permissions: [user.role]
    };
    const { expiration, token } = utils.signToken(payload);
    delete user.pwd;
    common.respond(req, res, 200, { result: { expiration, token, user } });
  } catch (err) {
    common.handleException(req, res, err);
  }
});

/**
 * @route POST /refreshToken
 * @description Refresca un token JWT para un usuario ya autenticado.
 * Utiliza la información del token actual para generar uno nuevo con una
 * nueva fecha de expiración.
 * @requires Un token JWT válido.
 * @returns {Object} 200 OK con el nuevo token, su expiración y los datos del usuario.
 */
router.post('/refreshToken', guard.check([['admin']]), async (req, res) => {
  try {
    const tokenInfo = req.user;
    let user;
    try {
      user = findUser(tokenInfo.email);
    } catch (err) {
      console.error('User file corrupted');
      return common.respond(req, res, 400, { code: 'ERR_INVALID_LOGIN' });
    }
    if (user == null) {
      return common.respond(req, res, 400, { code: 'ERR_USER_NOT_FOUND' });
    }
    const payload = {
      email: user.email,
      permissions: [user.role]
    };
    const { expiration, token } = utils.signToken(payload);
    delete user.pwd
    common.respond(req, res, 200, { result: { user, token, expiration } });
  } catch (err) {
    common.handleException(req, res, err);
  }
});

module.exports = { path: '/users', router, openEndpoints: ['/login'] };