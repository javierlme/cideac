const express = require('express');
const router = express.Router({ mergeParams: true });
const common = require('../common');
const guard = require('express-jwt-permissions')();
const upload = require('multer')({ dest: 'uploads' });
const xlsx = require('xlsx');
const path = require('path');
const { categories, cities } = require('../constants');
const fs = require('fs');
const GBService = require('../services/gb');
const GBNEEService = require('../services/gbnee');
const CEPService = require('../services/cep');
const CEDService = require('../services/ced');
const GMDService = require('../services/gmd');
const GMPService = require('../services/gmp');
const GSDService = require('../services/gsd');
const GSPService = require('../services/gsp');
const CGMDService = require('../services/cgmd');
const CGSDService = require('../services/cgsd');
const CCEDService = require('../services/cced');
const LeyendasService = require('../services/leyendas')
const {Buffer} = require('buffer');

const listDistanceCode = ['GMD', 'GSD', 'CED'];
const listPresentialCode = ['GB', 'GBNEE', 'GMP', 'GSP', 'CEP'];

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
      
      const config = buildConfig(req);
      for (const category of listDistanceCode) {
        await LeyendasService.buildPdfDistancia(req.body.city, category, config);
      };
      for (const category of listPresentialCode) {
        await LeyendasService.buildPdfPresencial(req.body.city, category, config);
      };

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
      const numeroCurso = getCellValue('J'+rowIndex)==''?Number(0):Number(getCellValue('J'+rowIndex))
      courses.push({
        codigoCentro: String(getCellValue('A'+rowIndex)).replace('.','').trim(),
        centro: getCellValue('B'+rowIndex),
        codigoCurso: String(getCellValue('C'+rowIndex)).replace('.','').trim(),
        curso: `${String(getCellValue('D'+rowIndex)).trim()} ${numeroCurso?`(Curso ${numeroCurso})`:''}`,
        codigoModulo: String(getCellValue('E'+rowIndex)).replace('.','').trim(),//.padStart(4, '0'),
        modulo: getCellValue('F'+rowIndex),
        maxHorasModulo: getCellValue('G'+rowIndex),
        vacantes: Number(getCellValue('H'+rowIndex)),
        abreviaturaModulo: getCellValue('I'+rowIndex),
        numeroCurso: numeroCurso
      });
      rowIndex++;
    }
  } else {
    while (getCellValue('E'+rowIndex) != '') {
      const numeroCurso = getCellValue('F'+rowIndex)==''?Number(0):Number(getCellValue('F'+rowIndex))
      courses.push({
        codigoCentro: String(getCellValue('A'+rowIndex)).replace('.','').trim(),
        centro: getCellValue('B'+rowIndex),
        codigoCurso: String(getCellValue('C'+rowIndex) + numeroCurso).replace('.','').trim(),
        curso: `${String(getCellValue('D'+rowIndex)).trim()} ${numeroCurso?`(Curso ${numeroCurso})`:''}`,
        vacantes: Number(getCellValue('E'+rowIndex)),
        numeroCurso: numeroCurso
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
      const config = buildConfig(req);
      switch (req.body.category) {
        case 'GB': {
          url = await GBService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'GBNEE': {
          url = await GBNEEService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'GMD': {
          if (req.body.city=='CIDEAD') {
            url = await CGMDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          }
          else {
            url = await GMDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          }
          break;
        }
        case 'GMP': {
          url = await GMPService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          break;
        }
        case 'GSD': {
          if (req.body.city=='CIDEAD') {
            url = await CGSDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          }
          else {
            url = await GSDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          }
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
          if (req.body.city=='CIDEAD') {
           url = await CCEDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          }
          else {
            url = await CEDService.processAssigns(req.body.category, req.body.city, req.file.path, config);
          }
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

router.get('/files/slots/:filename', guard.check([['admin']]), async (req, res) => {
  try {
    const filename = req.params.filename
    console.log(`filename:${filename}`)
    if (!filename) {
      return common.respond(req, res, 400, { codigoCurso: 'ERR_MISSING_PARAM', additionalInfo: { param: 'filename' } });
    }
    const filePath = path.join(__dirname, '..', 'data', `${filename}`);
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

router.get('/files/xlsx/:filename', guard.check([['admin']]), async (req, res) => {
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

const buildConfig = (req) => {
  return {
        
    "randomNumberSelected": Number(req.body.randomNumberSelected?req.body.randomNumberSelected:147),
    "percentageHandicap": Number(req.body.percentageHandicap?req.body.percentageHandicap:5)/100,
    "numSlotsBySeatHandicap": Number(req.body.numSlotsBySeatHandicap?req.body.numSlotsBySeatHandicap:1),
    "percentageAthlete": Number(req.body.percentageAthlete?req.body.percentageAthlete:5)/100,
    "numSlotsBySeatAthlete": Number(req.body.numSlotsBySeatAthlete?req.body.numSlotsBySeatAthlete:1),
    "percentageA": Number(req.body.percentageA?req.body.percentageA:80)/100,
    "percentageA1": Number(req.body.percentageA1?req.body.percentageA1:45)/100,
    "percentageA2": Number(req.body.percentageA2?req.body.percentageA2:55)/100,
    "percentageB": Number(req.body.percentageB?req.body.percentageB:15)/100,
    "percentageC": Number(req.body.percentageC?req.body.percentageC:5)/100,
    "plazasDpresencial": Number(req.body.plazasDpresencial?req.body.plazasDpresencial:3),
    "plazasDdistancia": Number(req.body.plazasDdistancia?req.body.plazasDdistancia:4),
    "plazasDcidead": Number(req.body.plazasDcidead?req.body.plazasDcidead:20),
    "plazasDce": Number(req.body.plazasDce?req.body.plazasDce:6),

    "titleGeneral": String(req.body.titleGeneral?req.body.titleGeneral:String()),
    "titleCurse": String(req.body.titleCurse?req.body.titleCurse:String()),
    "titleSlot": String(req.body.titleSlot?req.body.titleSlot:String()),
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

    "textGBNEETitleGeneral": String(req.body.textGBNEETitleGeneral?req.body.textGBNEETitleGeneral:String()),
    "textGBNEETypeGeneral": String(req.body.textGBNEETypeGeneral?req.body.textGBNEETypeGeneral:String()),
    "textGBNEETypeAthlete": String(req.body.textGBNEETypeAthlete?req.body.textGBNEETypeAthlete:String()),
    "textGBNEETypeHandicap": String(req.body.textGBNEETypeHandicap?req.body.textGBTypeHandicap:String()),
    "textGBNEER1": String(req.body.textGBNEER1?req.body.textGBNEER1:String()),
    "textGBNEER2": String(req.body.textGBNEER2?req.body.textGBNEER2:String()),
    "textGBNEER3": String(req.body.textGBNEER3?req.body.textGBNEER3:String()),

    "textGMTitleGeneral": String(req.body.textGMTitleGeneral?req.body.textGMTitleGeneral:String()),
    "textGMTypeA": String(req.body.textGMTypeA?req.body.textGMTypeA:String()),
    "textGMTypeB": String(req.body.textGMTypeB?req.body.textGMTypeB:String()),
    "textGMTypeC": String(req.body.textGMTypeC?req.body.textGMTypeC:String()),
    "textGMTypeD": String(req.body.textGMTypeD?req.body.textGMTypeD:String()),
    "textGMTypeAthlete": String(req.body.textGMTypeAthlete?req.body.textGMTypeAthlete:String()),
    "textGMTypeHandicap": String(req.body.textGMTypeHandicap?req.body.textGMTypeHandicap:String()),
    "textGMR1": String(req.body.textGMR1?req.body.textGMR1:String()),
    "textGMR2": String(req.body.textGMR2?req.body.textGMR2:String()),
    "textGMR3": String(req.body.textGMR3?req.body.textGMR3:String()),
    "textGMR4": String(req.body.textGMR4?req.body.textGMR4:String()),

    "textGSTitleGeneral": String(req.body.textGSTitleGeneral?req.body.textGSTitleGeneral:String()),
    "textGSTypeA1": String(req.body.textGSTypeA1?req.body.textGSTypeA1:String()),
    "textGSTypeA2": String(req.body.textGSTypeA2?req.body.textGSTypeA2:String()),
    "textGSTypeB": String(req.body.textGSTypeB?req.body.textGSTypeB:String()),
    "textGSTypeC": String(req.body.textGSTypeC?req.body.textGSTypeC:String()),
    "textGSTypeD": String(req.body.textGSTypeD?req.body.textGSTypeD:String()),
    "textGSTypeAthlete": String(req.body.textGSTypeAthlete?req.body.textGSTypeAthlete:String()),
    "textGSTypeHandicap": String(req.body.textGSTypeHandicap?req.body.textGSTypeHandicap:String()),
    "textGSR1": String(req.body.textGSR1?req.body.textGSR1:String()),
    "textGSR2": String(req.body.textGSR2?req.body.textGSR2:String()),
    "textGSR3": String(req.body.textGSR3?req.body.textGSR3:String()),
    "textGSR4": String(req.body.textGSR4?req.body.textGSR4:String()),

    "textCETitleGeneral": String(req.body.textCETitleGeneral?req.body.textCETitleGeneral:String()),
    "textCETypeGeneral": String(req.body.textCETypeGeneral?req.body.textCETypeGeneral:String()),
    "textCETypeAthlete": String(req.body.textCETypeAthlete?req.body.textCETypeAthlete:String()),
    "textCETypeHandicap": String(req.body.textCETypeHandicap?req.body.textCETypeHandicap:String()),
    "textCER1": String(req.body.textCER1?req.body.textCER1:String()),
    "textCER2": String(req.body.textCER2?req.body.textCER2:String()),
    "textCER3": String(req.body.textCER3?req.body.textCER3:String())
  }

}

module.exports = { path: '/courses', router, openEndpoints: [] };