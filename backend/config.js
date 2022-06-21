const config = {
  expressPort: process.env.PORT || 8081,
  serverSecret: process.env.SERVER_SECRET || 'cideac',
  baseUrl: process.env.BASE_URL || 'localhost:8081',
  tokenTTL: process.env.TOKEN_TTL || 60 * 24 * 7
};

module.exports = config;