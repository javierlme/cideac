/**
 * @file server.js
 * @description Punto de entrada principal de la API REST del sistema de asignación
 * de plazas de Formación Profesional (FP) para Ceuta, Melilla y CIDEAD.
 *
 * Responsabilidades:
 *  - Configuración de Express: middlewares (CORS, body-parser, cookies, compresión).
 *  - Protección JWT: todas las rutas están protegidas salvo las declaradas como abiertas.
 *  - Registro de routers: /users (autenticación) y /courses (gestión de plazas).
 *  - Servicio de archivos estáticos desde la carpeta /temp (PDFs y CSVs generados).
 *  - Manejo global de errores (express-jwt UnauthorizedError, errores genéricos).
 *
 * @exports {express.Application} app - Instancia de Express exportada para testing con supertest.
 */

/* ─────────────────────────────────────────────────────────────
   Propiedades globales de depuración (__stack, __file, __line, __function)
   Permiten obtener información de la pila de llamadas en tiempo de ejecución.
   ───────────────────────────────────────────────────────────── */
Object.defineProperty(global, '__stack', {
	get: function () {
		const orig = Error.prepareStackTrace;
		Error.prepareStackTrace = function (_, stack) {
			return stack;
		};
		const err = new Error;
		Error.captureStackTrace(err, arguments.callee);
		const stack = err.stack;
		Error.prepareStackTrace = orig;
		return stack;
	}
});
Object.defineProperty(global, '__file', {
	get: function () {
		return __stack[2].getFileName();
	}
});
Object.defineProperty(global, '__line', {
	get: function () {
		return __stack[2].getLineNumber();
	}
});
Object.defineProperty(global, '__function', {
	get: function () {
		return __stack[2].getFunctionName();
	}
});

/* ─── Configuración de Express y middlewares ─── */
const config = require('./config.js');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const fs = require('fs');

const httpServer = require('http').createServer(app);
app.use(compression());                                    // Compresión gzip de respuestas
app.use(cookieParser(config.serverSecret));                 // Parseo de cookies firmadas
// Los dos siguientes permiten peticiones de más de 50MB
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb', 'Content-Type': 'application/x-www-form-urlencoded' }));
app.use(methodOverride());                                 // Soporte para PUT/DELETE en formularios
/**
 * Middleware CORS: permite peticiones desde cualquier origen.
 * Intercepta peticiones OPTIONS (preflight) y las responde directamente.
 * Para peticiones text/*, acumula el body en req.text (stream manual).
 */
const enableCORS = function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cookie, x-access-token');
	res.header('Access-Control-Allow-Credentials', true);
	// intercept OPTIONS method
	if ('OPTIONS' === req.method) {
		res.status(200).jsonp({});
	} else {
		if (req.is('text/*')) {
			req.text = '';
			req.setEncoding('utf8');
			req.on('data', function (chunk) { req.text += chunk });
			req.on('end', next);
		} else {
			next();
		}
	}
};
app.use(enableCORS);

// TODO: Capa de seguridad por roles

/* ─── Carpeta estática para archivos generados (PDFs, CSVs, Excel de mejora) ─── */
const staticFolderName = 'temp';
if (!fs.existsSync(`${__dirname}/${staticFolderName}`)) {
	fs.mkdirSync(`${__dirname}/${staticFolderName}`);
}
app.use('/files', express.static(staticFolderName));

/* ─── Registro de routers y recolección de endpoints abiertos (sin JWT) ─── */
const routers = [
	require('./routers/users.js'),    // Autenticación: login, refreshToken
	require('./routers/courses.js'),  // Gestión de plazas: slots, assign, categorías, archivos
];
let openEndpoints = ['/'];
const rs = [];
for (const router of routers) {
	// app.use(router.path, router.router);
	rs.push(router);
	openEndpoints = openEndpoints.concat((router.openEndpoints || []).map(endpoint => `${router.path}${endpoint}`));
}
/* ─── Protección JWT: todas las rutas requieren token salvo openEndpoints ─── */
const jwt = require('express-jwt');
app.use(jwt({
	secret: config.serverSecret,
	algorithms: ['HS256'],
	getToken: function fromHeaderOrQuerystring(req) {
		return req.headers['x-access-token'];
	}
}).unless({ path: openEndpoints }));

for (const router of rs) {
	app.use(router.path, router.router);
}

/* ─── Ruta raíz: healthcheck básico ─── */
const router = express.Router();
router.get('/', function (req, res) {
	res.status(200).jsonp(`Servidor OK!`);
});
app.use(router);

/**
 * Manejador global de errores de Express.
 * - Errores de JWT (UnauthorizedError) → 401 ERR_NOT_AUTHORIZED
 * - Errores con flag letGo → se relanza para que lo capture el proceso
 * - Cualquier otro error → 500 ERR_UNKNOWN
 */
const genericErrorHandler = (err, req, res, next) => {
	if (err.letGo) {
		throw JSON.stringify(err);
	} else if (err.name == 'UnauthorizedError') {	// NOTE: Error lanzado por express-jwt
		res.status(401).jsonp({ code: 'ERR_NOT_AUTHORIZED', additionalInfo: { message: err.message } });
	} else {
		console.error(err);
		if (!res.headersSent) {
			res.status(500).jsonp({ code: 'ERR_UNKNOWN' });
		}
	}
};
/* ─── Arranque del servidor HTTP ─── */
app.use(genericErrorHandler);

// Start server only when executed directly (prevents Jest open handle when required in tests)
function startServer() {
    httpServer.listen(config.expressPort, function () {
        console.log(`Node server running on port:${config.expressPort}`);
    });
    httpServer.setTimeout(0);  // Sin timeout para operaciones de larga duración (generación de PDFs)
}

// If server.js is run directly (node server.js), start the server.
// When required by tests, the server is not started and tests can use the exported `app` with supertest.
if (require.main === module) {
    startServer();
}

// Expose helpers for tests to control the HTTP server explicitly if needed
app.startServer = startServer;
app.httpServer = httpServer;
app.closeServer = function (callback) {
    if (httpServer && httpServer.listening) {
        httpServer.close(callback);
    } else if (callback) {
        callback();
    }
};

/* ─── Captura global de errores no controlados ─── */
// UNHANDLED ERRORS
process.on('unhandledRejection', err => {
    console.error({ desc: 'Promesa no controlada', err: err.message });
});
process.on('uncaughtException', function (err) {
    if (err.letGo) {
        throw JSON.stringify(err);
    } else {
        console.error({ desc: 'Excepción no controlada', err: err.stack });
    }
});

module.exports = app;