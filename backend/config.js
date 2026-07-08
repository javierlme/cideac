/**
 * @file config.js
 * @description Configuración central del servidor. Define los parámetros básicos
 * de la aplicación: puerto de escucha, secreto para firmar tokens JWT y tiempo
 * de vida (TTL) de los tokens. Todos los valores se pueden sobreescribir mediante
 * variables de entorno (PORT, SERVER_SECRET, TOKEN_TTL).
 */
const config = {
  /** Puerto en el que escucha Express. Por defecto 8081. */
  expressPort: process.env.PORT || 8081,
  /** Secreto utilizado para firmar y verificar los tokens JWT (HS256). */
  serverSecret: process.env.SERVER_SECRET || 'cideac',
  /** Tiempo de vida del token en minutos. Por defecto 1 semana (60 * 24 * 7 = 10080 min). */
  tokenTTL: process.env.TOKEN_TTL || 60 * 24 * 7
};

module.exports = config;