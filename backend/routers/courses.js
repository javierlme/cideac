const express = require('express');
const router = express.Router({ mergeParams: true });
const common = require('../common');
const guard = require('express-jwt-permissions')();
const upload = require('multer')({ dest: 'uploads' });
const xlsx = require('xlsx');
const path = require('path');
const { categories, cities } = require('../constants');
const fs = require('fs');
const CEPService = require('../services/cep');
const CEDService = require('../services/ced');
const GBService = require('../services/gb');
const GMDService = require('../services/gmd');
const GMPService = require('../services/gmp');
const GSDService = require('../services/gsd');
const GSPService = require('../services/gsp');
const {Buffer} = require('buffer');

const listDistanceCode = ['GMD', 'GSD', 'CED'];

router.post('/slots', guard.check([['admin']]),
  upload.single('file'), async (req, res) => {
    try {
      if (req.file == null) {
        return common.respond(req, res, 400, {
          codigoCurso: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'file' },
        });
      }
      if (![".xls", ".xlsx"].includes(path.extname(req.file.originalname).toLowerCase())) {
        return common.respond(req, res, 400, {
          codigoCurso: "ERR_INVALID_FILE",
          additionalInfo: {
            desc: "El fichero debe ser excel - .xlsx|.xls extension",
          }
        });
      }
      if (!req.body.city) {
        return common.respond(req, res, 400, {
          codigoCurso: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'city' }
        });
      }
      if (!cities.includes(req.body.city)) {
        return common.respond(req, res, 400, {
          codigoCurso: "ERR_INVALID_PARAM",
          additionalInfo: { desc: `El parámetro ciudad debe ser uno de los siguientes ${cities.join(', ')}` }
        });
      }
      const wb = xlsx.readFile(
        req.file.path
      );
      let errors = [];
      const sheets = categories
        .filter(c => c.city === req.body.city)
        .map(c => c.code);
      sheets.forEach(codigoCurso => {
        if (!wb.SheetNames.includes(codigoCurso)) {
          errors.push(`Falta la hoja ${codigoCurso}`);
        }
      });
      if (errors.length > 0) {
        return common.respond(req, res, 400, {
          codigoCurso: 'ERR_IN_EXCEL_FILE',
          additionalInfo: { desc: errors.join('\r\n') },
        });
      }
      await fs.promises.copyFile(req.file.path, path.join(__dirname, "..", "data", `${req.body.city}_slots.xls`));
      await fs.promises.rm(req.file.path);
      common.respond(req, res, 200, {});
    } catch (err) {
      common.handleException(req, res, err);
    }
  });

exports.getCategoryCourses = async (city, category) => {
  const filePath = path.join(__dirname, '..', 'data', `${city}_slots.xls`);
  if (!fs.existsSync(filePath)) {
    throw {
      httpCode: 400,
      codigoCurso: 'ERR_SLOTS_FILE_NOT_SET',
      additionalinfo: { city, category }
    };
  }
  const sheet = category;
  const wb = xlsx.readFile(
    filePath
  );
  function getCellValue(cell) {
    const cellValue = wb.Sheets[sheet][cell];
    return cellValue ? cellValue.w || cellValue.v.toString() || '' : '';
  }
  const courses = [];
  let rowIndex = 2;
  if (listDistanceCode.includes(sheet)) {
    while (getCellValue('H'+rowIndex) != '') {
      courses.push({
        codigoCentro: getCellValue('A'+rowIndex),
        centro: getCellValue('B'+rowIndex),
        codigoCurso: getCellValue('C'+rowIndex),
        curso: getCellValue('D'+rowIndex),
        codigoModulo: getCellValue('E'+rowIndex),
        modulo: getCellValue('F'+rowIndex),
        maxHorasModulo: getCellValue('G', rowIndex),
        vacantes: getCellValue('H'+rowIndex),
        abreviaturaModulo: getCellValue('I'+rowIndex)
      });
      rowIndex++;
    }
  } else {
    while (getCellValue('E'+rowIndex) != '') {
      courses.push({
        codigoCentro: getCellValue('A'+rowIndex),
        centro: getCellValue('B'+rowIndex),
        codigoCurso: getCellValue('C'+rowIndex),
        curso: getCellValue('D'+rowIndex),
        vacantes: getCellValue('E'+rowIndex)
      });
      rowIndex++;
    }
  }
  return courses;
}

router.post('/assign', guard.check([['admin']]),
  upload.single('file'), async (req, res) => {
    try {
      if (req.file == null) {
        return common.respond(req, res, 400, {
          codigoCurso: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'file' },
        });
      }
      if (!['.xlsx', '.xls'].includes(path.extname(req.file.originalname).toLowerCase())) {
        return common.respond(req, res, 400, {
          codigoCurso: 'ERR_INVALID_FILE',
          additionalInfo: { desc: 'El fichero debe ser excel - .xlsx|.xls extension' },
        });
      }
      if (!req.body.city) {
        return common.respond(req, res, 400, {
          codigoCurso: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'city' }
        });
      }
      if (!cities.includes(req.body.city)) {
        return common.respond(req, res, 400, {
          codigoCurso: "ERR_INVALID_PARAM",
          additionalInfo: {
            desc: `The param city has to be one of ${cities.join(", ")}`,
          },
        });
      }

      let url;
      const config = {
        
        "randomNumberSelected": Number(req.body.randomNumberSelected?req.body.randomNumberSelected:147),
        "percentageHandicap": Number(req.body.percentageHandicap?req.body.percentageHandicap:5)/100,
        "numSlotsBySeatHandicap": Number(req.body.numSlotsBySeatHandicap?req.body.numSlotsBySeatHandicap:1),
        "percentageAthlete": Number(req.body.percentageAthlete?req.body.percentageAthlete:5)/100,
        "numSlotsBySeatAthlete": Number(req.body.numSlotsBySeatAthlete?req.body.numSlotsBySeatAthlete:1),
        "percentageA": Number(req.body.percentageA?req.body.percentageA:60)/100,
        "percentageB": Number(req.body.percentageB?req.body.percentageB:30)/100,
        "percentageC": Number(req.body.percentageC?req.body.percentageC:10)/100,

        "titleGeneral": String(req.body.titleGeneral?req.body.titleGeneral:String()),
        "titleCurse": String(req.body.titleCurse?req.body.titleCurse:String()),
        "titleAdmitted": String(req.body.titleAdmitted?req.body.titleAdmitted:String()),
        "titleWaiting": String(req.body.titleWaiting?req.body.titleWaiting:String()),
        "titleRejected": String(req.body.titleAdmitted?req.body.titleRejected:String()),
        "titleWarning": String(req.body.titleWarning?req.body.titleWarning:String()),

        "textGBTitleGeneral": String(req.body.textGBTitleGeneral?req.body.textGBTitleGeneral:String()),
        "textGBTypeGeneral": String(req.body.textGBTypeGeneral?req.body.textGBTypeGeneral:String()),
        "textGBTypeAthlete": String(req.body.textGBTypeAthlete?req.body.textGBTypeAthlete:String()),
        "textGBTypeHandicap": String(req.body.textGBTypeHandicap?req.body.textGBTypeHandicap:String()),
        "textGBR1": String(req.body.textGBR1?req.body.textGBR1:String()),
        "textGBR2": String(req.body.textGBR2?req.body.textGBR2:String()),
        "textGBR3": String(req.body.textGBR3?req.body.textGBR3:String()),

        "textGMTitleGeneral": String(req.body.textGMTitleGeneral?req.body.textGMTitleGeneral:String()),
        "textGMTypeA": String(req.body.textGMTypeA?req.body.textGMTypeA:String()),
        "textGMTypeB": String(req.body.textGMTypeB?req.body.textGMTypeB:String()),
        "textGMTypeC": String(req.body.textGMTypeC?req.body.textGMTypeC:String()),
        "textGMTypeAthlete": String(req.body.textGMTypeAthlete?req.body.textGMTypeAthlete:String()),
        "textGMTypeHandicap": String(req.body.textGMTypeHandicap?req.body.textGMTypeHandicap:String()),
        "textGMR1": String(req.body.textGMR1?req.body.textGMR1:String()),
        "textGMR2": String(req.body.textGMR2?req.body.textGMR2:String()),
        "textGMR3": String(req.body.textGMR3?req.body.textGMR3:String()),

        "textGSTitleGeneral": String(req.body.textGSTitleGeneral?req.body.textGSTitleGeneral:String()),
        "textGSTypeA": String(req.body.textGSTypeA?req.body.textGSTypeA:String()),
        "textGSTypeB": String(req.body.textGSTypeB?req.body.textGSTypeB:String()),
        "textGSTypeC": String(req.body.textGSTypeC?req.body.textGSTypeC:String()),
        "textGSTypeAthlete": String(req.body.textGSTypeAthlete?req.body.textGSTypeAthlete:String()),
        "textGSTypeHandicap": String(req.body.textGSTypeHandicap?req.body.textGSTypeHandicap:String()),
        "textGSR1": String(req.body.textGSR1?req.body.textGSR1:String()),
        "textGSR2": String(req.body.textGSR2?req.body.textGSR2:String()),
        "textGSR3": String(req.body.textGSR3?req.body.textGSR3:String()),

        "textCETitleGeneral": String(req.body.textCETitleGeneral?req.body.textCETitleGeneral:String()),
        "textCETypeGeneral": String(req.body.textCETypeGeneral?req.body.textCETypeGeneral:String()),
        "textCETypeAthlete": String(req.body.textCETypeAthlete?req.body.textCETypeAthlete:String()),
        "textCETypeHandicap": String(req.body.textCETypeHandicap?req.body.textCETypeHandicap:String()),
        "textCER1": String(req.body.textCER1?req.body.textCER1:String()),
        "textCER2": String(req.body.textCER2?req.body.textCER2:String()),
        "textCER3": String(req.body.textCER3?req.body.textCER3:String())
      }
      switch (req.body.category) {
        case 'GB': {
          url = await GBService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'GMD': {
          url = await GMDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'GMP': {
          url = await GMPService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'GSD': {
          url = await GSDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'GSP': {
          url = await GSPService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'CEP': {
          url = await CEPService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'CED': {
          url = await CEDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        default: {
          return common.respond(req, res, 400, { 
            codigoCurso: 'ERR_INVALID_CATEGORY',
            additionalInfo: {
              desc: `la categoría ${req.body.category} no existe en el fichero de solicitudes`,
            } });
        }
      }
      common.respond(req, res, 200, { url });
    } catch (err) {
      common.handleException(req, res, err);
    }
  });

router.get('/categories', guard.check([['admin']]), async (req, res) => {
  try {
    common.respond(req, res, 200, { result: categories });
  } catch (err) {
    common.handleException(req, res, err);
  }
});

router.get('/checkSlots', guard.check([['admin']]), async (req, res) => {
  try {
    if (!req.query.city) {
      return common.respond(req, res, 400, { codigoCurso: 'ERR_MISSING_PARAM', additionalInfo: { param: 'city' } });
    }
    const filePath = path.join(__dirname, '..', 'data', `${req.query.city}_slots.xls`);
    common.respond(req, res, 200, { result: await fs.existsSync(filePath) });
  } catch (err) {
    common.handleException(req, res, err);
  }
});

router.delete('/slots/:city', guard.check([['admin']]), async (req, res) => {
  try {
    const city = req.params.city
    if (!city) {
      return common.respond(req, res, 400, { codigoCurso: 'ERR_MISSING_PARAM', additionalInfo: { param: 'city' } });
    }
    const filePath = path.join(__dirname, '..', 'data', `${city}_slots.xls`);
    await fs.rmSync(filePath)
    common.respond(req, res, 200, {});
  } catch (err) {
    common.handleException(req, res, err);
  }
});

router.get('/files/excel/:filename', guard.check([['admin']]), async (req, res) => {
  try {
    const filename = req.params.filename
    console.log(`filename:${filename}`)
    if (!filename) {
      return common.respond(req, res, 400, { codigoCurso: 'ERR_MISSING_PARAM', additionalInfo: { param: 'filename' } });
    }
    const filePath = path.join(__dirname, '..', 'temp', `${filename}`);
    const contentFile = await fs.readFileSync(filePath)
    if (!contentFile) {
      return common.respond(req, res, 404, { codigoCurso: 'ERR_FILE_NOT_FOUND', additionalInfo: { param: 'filename' } });
    }
    const bufferBase64 = Buffer(contentFile).toString('base64')
    common.respond(req, res, 200, bufferBase64);
  } catch (err) {
    common.handleException(req, res, err);
  }
});

router.get('/files/pdf/:filename', guard.check([['admin']]), async (req, res) => {
  try {
    const filename = req.params.filename
    console.log(`filename:${filename}`)
    if (!filename) {
      return common.respond(req, res, 400, { codigoCurso: 'ERR_MISSING_PARAM', additionalInfo: { param: 'filename' } });
    }
    const filePath = path.join(__dirname, '..', 'temp', `${filename}`);
    const contentFile = await fs.readFileSync(filePath);
    if (!contentFile) {
      return common.respond(req, res, 404, { codigoCurso: 'ERR_FILE_NOT_FOUND', additionalInfo: { param: 'filename' } });
    }
    const bufferBase64 = Buffer(contentFile).toString('base64')
    common.respond(req, res, 200, bufferBase64);
  } catch (err) {
    common.handleException(req, res, err);
  }
});

module.exports = { path: '/courses', router, openEndpoints: [] };