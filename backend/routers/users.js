const express = require('express');
const router = express.Router({ mergeParams: true });
const common = require('../common');
const crypto = require('crypto');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const guard = require('express-jwt-permissions')();

const readUsers = () => {
  const usersInfo = fs.readFileSync(path.join(__dirname, '..', 'data', 'users.json'), 'utf-8');
  return JSON.parse(usersInfo);
};

const findUser = (email, pwd = null) => {
  const users = readUsers();
  // TODO: ¿Case insensitive en el email?
  return users.find(u => u.email === email && (pwd == null || u.pwd === pwd));
};

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