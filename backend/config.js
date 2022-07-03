const config = {
  expressPort: process.env.PORT || 8081,
  serverSecret: process.env.SERVER_SECRET || 'cideac',
  tokenTTL: process.env.TOKEN_TTL || 60 * 24 * 7
};

module.exports = config;