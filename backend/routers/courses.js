const express = require('express');
const router = express.Router({ mergeParams: true });
const common = require('../common');
const guard = require('express-jwt-permissions')();
const upload = require('multer')({ dest: 'uploads' });
const xlsx = require('xlsx');
const path = require('path');
const { categories, cities } = require('../constants');
const fs = require('fs');
const CEService = require('../services/ce');
const FPBService = require('../services/fpb');
const GMDService = require('../services/gmd');
const GMPService = require('../services/gmp');
const GSDService = require('../services/gsd');
const GSPService = require('../services/gsp');
const config = require('../config');
const {Buffer} = require('buffer');

const slotsColumns = {
  ['codigo centro ']: 'A',
  ['nombre centro']: 'B',
  ['codigo ciclo']: 'C',
  ['nombre ciclo']: 'D',
  ['vacantes']: 'E'
};
const distanceSlotsColumns = {
  ['codigo centro']: 'A',
  ['nombre centro']: 'B',
  ['codigo ciclo']: 'C',
  ['nombre ciclo']: 'D',
  ['codigo modulo']: 'E',
  ['nombre del modulo']: 'F',
  ['vacantes']: 'G',
  ['numero horas']: 'H'
};
const listDistanceCode = ['GMD', 'GSD', 'CE'];

router.post('/slots', guard.check([['admin']]),
  upload.single('file'), async (req, res) => {
    try {
      if (req.file == null) {
        return common.respond(req, res, 400, {
          code: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'file' },
        });
      }
      if (![".xls", ".xlsx"].includes(path.extname(req.file.originalname).toLowerCase())) {
        return common.respond(req, res, 400, {
          code: "ERR_INVALID_FILE",
          additionalInfo: {
            desc: "El fichero debe ser excel - .xlsx|.xls extension",
          },
        });
      }
      if (!req.body.city) {
        return common.respond(req, res, 400, {
          code: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'city' }
        });
      }
      if (!cities.includes(req.body.city)) {
        return common.respond(req, res, 400, {
          code: "ERR_INVALID_PARAM",
          additionalInfo: { desc: `The param city has to be one of ${cities.join(', ')}` },
        });
      }
      function getCellValue(sheet, cell) {
        const cellValue = wb.Sheets[sheet][cell];
        return cellValue ? cellValue.w || cellValue.v.toString() || '' : '';
      }
      const readCell = (sheet, column, row) => {
        const columns = listDistanceCode.includes(sheet) ? distanceSlotsColumns : slotsColumns;
        return getCellValue(sheet, `${columns[column]}${row}`);
      }
      const wb = xlsx.readFile(
        req.file.path
      );
      let errors = [];
      const sheets = categories
        .filter(c => c.city === req.body.city)
        .map(c => c.code);
      sheets.forEach(code => {
        if (!wb.SheetNames.includes(code)) {
          errors.push(`Falta la hoja ${code}`);
        } else {
          const headerRow = 1;
          const columns = listDistanceCode.includes(code) ? distanceSlotsColumns : slotsColumns;
          Object.keys(columns).forEach(key => {
            if (readCell(code, key, headerRow) != key) {
              errors.push(`Hoja Excel ${code} - La celda de la cabecera ${columns[key]}${headerRow} debe ser ${key}`);
            }
          });
        }
      });
      if (errors.length > 0) {
        return common.respond(req, res, 400, {
          code: 'ERR_IN_EXCEL_FILE',
          additionalInfo: { desc: errors.join('\r\n') },
        });
      }
      // await fs.promises.rename(
      //   req.file.path,
      //   path.join(__dirname, "..", "data", `${req.body.city}_slots.xls`)
      // );
      await fs.promises.copyFile(
        req.file.path,
        path.join(__dirname, "..", "data", `${req.body.city}_slots.xls`)
      );
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
      code: 'ERR_SLOTS_FILE_NOT_SET',
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
  const readCell = (column, row) => {
    const columns = listDistanceCode.includes(sheet) ? distanceSlotsColumns : slotsColumns;
    return getCellValue(`${columns[column]}${row}`);
  }
  const courses = [];
  let rowIndex = 2;
  if (listDistanceCode.includes(sheet)) {
    let course;
    while (readCell('vacantes', rowIndex) != '') {
      course = courses.find(c => c.code === readCell('codigo ciclo', rowIndex) && c.schoolCode === readCell('codigo centro', rowIndex));
      if (course == null) {
        course = {
          code: readCell('codigo ciclo', rowIndex),
          // slots: readCell('vacantes', rowIndex),
          schoolCode: readCell('codigo centro', rowIndex),
          school: readCell('nombre centro', rowIndex),
          course: readCell('nombre ciclo', rowIndex),
          modules: [{
            code: readCell('codigo modulo', rowIndex),
            name: readCell('nombre del modulo', rowIndex),
            slots: readCell('vacantes', rowIndex),
            grade: readCell('CURSO', rowIndex),
          }]
        };
        courses.push(course);
      } else {
        course.modules.push({
          code: readCell('codigo modulo', rowIndex),
          name: readCell('nombre del modulo', rowIndex),
          slots: readCell('vacantes', rowIndex),
          grade: readCell('CURSO', rowIndex),
        });
      }
      rowIndex++;
    }
    for (course of courses) {
      course.slots = Math.min(course.modules.map(m => m.slots));
    }
  } else {
    while (readCell('vacantes', rowIndex) != '') {
      courses.push({
        code: readCell('codigo ciclo', rowIndex),
        slots: readCell('vacantes', rowIndex),
        schoolCode: readCell('codigo centro ', rowIndex),
        school: readCell('nombre centro', rowIndex),
        course: readCell('nombre ciclo', rowIndex),
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
          code: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'file' },
        });
      }
      if (!['.xlsx', '.xls'].includes(path.extname(req.file.originalname).toLowerCase())) {
        return common.respond(req, res, 400, {
          code: 'ERR_INVALID_FILE',
          additionalInfo: { desc: 'El fichero debe ser excel - .xlsx|.xls extension' },
        });
      }
      if (!req.body.city) {
        return common.respond(req, res, 400, {
          code: 'ERR_MISSING_PARAM',
          additionalInfo: { param: 'city' }
        });
      }
      if (!cities.includes(req.body.city)) {
        return common.respond(req, res, 400, {
          code: "ERR_INVALID_PARAM",
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
        "percentageA": Number(req.body.percentageA?req.body.percentageA:60),
        "percentageB": Number(req.body.percentageB?req.body.percentageB:30),
        "percentageC": Number(req.body.percentageC?req.body.percentageC:10),

        "titleGeneral": String(req.body.titleGeneral?req.body.titleGeneral:String()),
        "titleCurse": String(req.body.titleCurse?req.body.titleCurse:String()),
        "titleAdmitted": String(req.body.titleAdmitted?req.body.titleAdmitted:String()),
        "titleWarning": String(req.body.titleWarning?req.body.titleWarning:String()),

        "textGBTitleGeneral": String(req.body.textGBTitleGeneral?req.body.textGBTitleGeneral:String()),
        "textGBTypeGeneral": String(req.body.textGBTypeGeneral?req.body.textGBTypeGeneral:String()),
        "textGBTypeAthlete": String(req.body.textGBTypeAthlete?req.body.textGBTypeAthlete:String()),
        "textGBTypeHandicap": String(req.body.textGBTypeHandicap?req.body.textGBTypeHandicap:String()),

        "textGMTitleGeneral": String(req.body.textGMTitleGeneral?req.body.textGMTitleGeneral:String()),
        "textGMTypeA": String(req.body.textGMTypeA?req.body.textGMTypeA:String()),
        "textGMTypeB": String(req.body.textGMTypeB?req.body.textGMTypeB:String()),
        "textGMTypeC": String(req.body.textGMTypeC?req.body.textGMTypeC:String()),
        "textGMTypeAthlete": String(req.body.textGMTypeAthlete?req.body.textGMTypeAthlete:String()),
        "textGMTypeHandicap": String(req.body.textGMTypeHandicap?req.body.textGMTypeHandicap:String()),

        "textGSTitleGeneral": String(req.body.textGSTitleGeneral?req.body.textGSTitleGeneral:String()),
        "textGSTypeA": String(req.body.textGSTypeA?req.body.textGSTypeA:String()),
        "textGSTypeB": String(req.body.textGSTypeB?req.body.textGSTypeB:String()),
        "textGSTypeC": String(req.body.textGSTypeC?req.body.textGSTypeC:String()),
        "textGSTypeAthlete": String(req.body.textGSTypeAthlete?req.body.textGSTypeAthlete:String()),
        "textGSTypeHandicap": String(req.body.textGSTypeHandicap?req.body.textGSTypeHandicap:String()),

        "textCETitleGeneral": String(req.body.textCETitleGeneral?req.body.textCETitleGeneral:String()),
        "textCETypeGeneral": String(req.body.textCETypeGeneral?req.body.textCETypeGeneral:String()),
        "textCETypeAthlete": String(req.body.textCETypeAthlete?req.body.textCETypeAthlete:String()),
        "textCETypeHandicap": String(req.body.textCETypeHandicap?req.body.textCETypeHandicap:String())
      }
      switch (req.body.category) {
        case 'FPB': {
          url = await FPBService.processAssigns(req.body.category, req.body.city, req.file.path, config, false);
          break;
        }
        case 'GMD': {
          url = await GMDService.processAssigns(req.body.category, req.body.city, req.file.path, config, true);
          break;
        }
        case 'GMP': {
          url = await GMPService.processAssigns(req.body.category, req.body.city, req.file.path, config, false);
          break;
        }
        case 'GSD': {
          url = await GSDService.processAssigns(req.body.category, req.body.city, req.file.path, config, true);
          break;
        }
        case 'GSP': {
          url = await GSPService.processAssigns(req.body.category, req.body.city, req.file.path, req.body.config, false);
          break;
        }
        case 'CE': {
          url = await CEService.processAssigns(req.body.category, req.body.city, req.file.path, config, true);
          break;
        }
        default: {
          return common.respond(req, res, 400, { code: 'ERR_INVALID_CATEGORY' });
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
      return common.respond(req, res, 400, { code: 'ERR_MISSING_PARAM', additionalInfo: { param: 'city' } });
    }
    const filePath = path.join(__dirname, '..', 'data', `${req.query.city}_slots.xls`);
    common.respond(req, res, 200, { result: await fs.existsSync(filePath) });
  } catch (err) {
    common.handleException(req, res, err);
  }
});

router.get('/files/excel/:filename', guard.check([['admin']]), async (req, res) => {
  try {

    const filename = req.params.filename
    console.log(`filename:${filename}`)
    if (!filename) {
      return common.respond(req, res, 400, { code: 'ERR_MISSING_PARAM', additionalInfo: { param: 'filename' } });
    }
    const filePath = path.join(__dirname, '..', 'temp', `${filename}`);
    const contentFile = await fs.readFileSync(filePath)
    if (!contentFile) {
      return common.respond(req, res, 404, { code: 'ERR_FILE_NOT_FOUND', additionalInfo: { param: 'filename' } });
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
      return common.respond(req, res, 400, { code: 'ERR_MISSING_PARAM', additionalInfo: { param: 'filename' } });
    }
    const filePath = path.join(__dirname, '..', 'temp', `${filename}`);
    const contentFile = await fs.readFileSync(filePath);
    if (!contentFile) {
      return common.respond(req, res, 404, { code: 'ERR_FILE_NOT_FOUND', additionalInfo: { param: 'filename' } });
    }
    const bufferBase64 = Buffer(contentFile).toString('base64')
    common.respond(req, res, 200, bufferBase64);
  } catch (err) {
    common.handleException(req, res, err);
  }
});

module.exports = { path: '/courses', router, openEndpoints: [] };