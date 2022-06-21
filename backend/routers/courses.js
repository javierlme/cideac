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
            desc: "It must be an excel file - .xlsx|.xls extension",
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
          errors.push(`Missing sheet ${code}`);
        } else {
          const headerRow = 1;
          const columns = listDistanceCode.includes(code) ? distanceSlotsColumns : slotsColumns;
          Object.keys(columns).forEach(key => {
            if (readCell(code, key, headerRow) != key) {
              errors.push(`Sheet ${code} - Header cell ${columns[key]}${headerRow} must be ${key}`);
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
          additionalInfo: { desc: 'It must be an excel file - .xlsx|.xls extension' },
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
      switch (req.body.category) {
        case 'CE': {
          url = await CEService.processAssigns(req.body.category, req.body.city, req.file.path);
          break;
        }
        case 'FPB': {
          url = await FPBService.processAssigns(req.body.category, req.body.city, req.file.path);
          break;
        }
        case 'GMD': {
          url = await GMDService.processAssigns(req.body.category, req.body.city, req.file.path);
          break;
        }
        case 'GMP': {
          url = await GMPService.processAssigns(req.body.category, req.body.city, req.file.path);
          break;
        }
        case 'GSD': {
          url = await GSDService.processAssigns(req.body.category, req.body.city, req.file.path);
          break;
        }
        case 'GSP': {
          url = await GSPService.processAssigns(req.body.category, req.body.city, req.file.path);
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

router.get('/files/:filename', guard.check([['admin']]), async (req, res) => {
  try {

    const filename = req.params.filename
    console.log(`filename:${filename}`)
    if (!filename) {
      return common.respond(req, res, 400, { code: 'ERR_MISSING_PARAM', additionalInfo: { param: 'filename' } });
    }
    const filePath = path.join(__dirname, '..', 'temp', `${filename}`);
    const contentFile = await fs.readFileSync(filePath, 'utf8')
    common.respond(req, res, 200, contentFile);
  } catch (err) {
    common.handleException(req, res, err);
  }
});

module.exports = { path: '/courses', router, openEndpoints: [] };