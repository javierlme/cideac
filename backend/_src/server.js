/*Código que habilita información para debug y tratamiento de errores.*/
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

const config = require('./config.js');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const fs = require('fs');

const httpServer = require('http').createServer(app);
app.use(compression());
app.use(cookieParser(config.serverSecret));
// Los dos siguientes permiten peticiones de más de 50MB
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb', 'Content-Type': 'application/x-www-form-urlencoded' }));
app.use(methodOverride());
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

const staticFolderName = 'temp';
if (!fs.existsSync(`${__dirname}/${staticFolderName}`)) {
	fs.mkdirSync(`${__dirname}/${staticFolderName}`);
}
app.use('/files', express.static(staticFolderName));

const routers = [
	require('./routers/users.js'),
	require('./routers/courses.js'),
];
let openEndpoints = ['/'];
const rs = [];
for (const router of routers) {
	// app.use(router.path, router.router);
	rs.push(router);
	openEndpoints = openEndpoints.concat((router.openEndpoints || []).map(endpoint => `${router.path}${endpoint}`));
}
const jwt = require('express-jwt');
app.use(jwt({
	secret: config.SERVER_SECRET,
	algorithms: ['HS256'],
	getToken: function fromHeaderOrQuerystring(req) {
		return req.headers['x-access-token'];
	}
}).unless({ path: openEndpoints }));

for (const router of rs) {
	app.use(router.path, router.router);
}

const router = express.Router();
router.get('/', function (req, res) {
	res.status(200).jsonp(`Hello world!`);
});
app.use(router);

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
app.use(genericErrorHandler);
httpServer.listen(config.expressPort, function () {
	console.log(`Node server running on http://localhost:${config.expressPort}`);
});
httpServer.setTimeout(0);

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