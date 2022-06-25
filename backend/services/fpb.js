const xlsx = require('xlsx');
const path = require('path');
const { randomNumber } = require('../constants');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

const FPBColumns = {
  ['NÚMERO DOCUMENTO DE IDENTIDAD']: 'A',
  ['NUMERO SOLICITUD']: 'B',
  ['NÚMERO ALEATORIO']: 'C',
  ['IDENTIFICACIÓN']: 'D',
  ['NEE']: 'E',
  ['SELECCIONE CENTRO Y CICLO FORMATIVO [1]']: 'F',
  ['SELECCIONE CENTRO Y CICLO FORMATIVO [2]']: 'G',
  ['SELECCIONE CENTRO Y CICLO FORMATIVO [3]']: 'H',
  ['SELECCIONE CENTRO Y CICLO FORMATIVO [4]']: 'I',
  ['BAREMO POR AÑO DE NACIMIENTO']: 'J',
  ['POR ESTUDIOS CURSADOS EN 2020-2021']: 'K',
  ['BAREMO POR ESTUDIOS EN MISMA CIUDAD']: 'L',
  ['SUMA BAREMO']: 'M',
  ['ALUMNO CON MINUSVALÍA']: 'N',
  ['DEPORTISTA DE ÉLITE']: 'O',
};


async function processAssigns(category, city, filePath, config) {
  const courses = await courseService.getCategoryCourses(city, 'FPB');
  const wb = xlsx.readFile(
    filePath
  );
  const dataSheet = wb.SheetNames[0];
  function getCellValue(cell) {
    const cellValue = wb.Sheets[dataSheet][cell];
    return cellValue ? cellValue.w || cellValue.v.toString() || '' : '';
  }
  const readCell = (column, row) => {
    return getCellValue(`${FPBColumns[column]}${row}`);
  }
  const headerRow = 3;
  const errors = [];
  Object.keys(FPBColumns).forEach(key => {
    if (readCell(key, headerRow) != key) {
      errors.push(`Header cell ${FPBColumns[key]}${headerRow} must be ${key}`);
    }
  });
  if (errors.length > 0) {
    throw {
      httpCode: 400,
      code: 'ERR_INVALID_EXCEL_COLUMN',
      additionalInfo: { desc: errors.join('\r\n') },
    };
  }
  const readRow = (index) => {
    return readCell('NÚMERO DOCUMENTO DE IDENTIDAD', index) != '';
  };
  let rowIndex = 4;
  const applications = [];
  let application;
  const validateAndAppendCourse = (field, application, mandatory = false) => {
    const course = readCell(field, rowIndex);
    if (!course) {
      if (!mandatory) {
        return;
      } else {
        throw {
          httpCode: 400,
          code: 'ERR_MISSING_MANDATORY_COURSE',
          additionalInfo: {
            rowIndex,
            desc: `La fila ${rowIndex} no tiene ningún curso solicitado`
          }
        }
      }
    }
    const selectedCourse = courses.find(c =>
      (course.match(new RegExp(c.code, 'i')) != null) &&
      (course.match(new RegExp(c.schoolCode, 'i')) != null)
    ); // NOTE: Buscamos que contenga el código del curso y el centro
    if (selectedCourse == null) {
      throw {
        httpCode: 400, code: 'ERR_INVALID_COURSE',
        additionalInfo: {
          rowIndex,
          desc: `Curso inválido ${course} en la fila ${rowIndex}`
        }
      };
    } else {
      application.courses.push(selectedCourse);
    }
  }
  // NOTE: Código para grado medio melilla, pendiente extender/generalizar
  while (readRow(rowIndex)) {
    application = {
      applicationId: readCell('NUMERO SOLICITUD', rowIndex),
      docId: readCell('NÚMERO DOCUMENTO DE IDENTIDAD', rowIndex),
      randomNumber: readCell('NÚMERO ALEATORIO', rowIndex),
      personalId: readCell('IDENTIFICACIÓN', rowIndex),
      especialNeeds: readCell('NEE', rowIndex).toLowerCase() === 'si',
      courses: []
    };
    validateAndAppendCourse('SELECCIONE CENTRO Y CICLO FORMATIVO [1]', application, true);
    validateAndAppendCourse('SELECCIONE CENTRO Y CICLO FORMATIVO [2]', application);
    validateAndAppendCourse('SELECCIONE CENTRO Y CICLO FORMATIVO [3]', application);
    validateAndAppendCourse('SELECCIONE CENTRO Y CICLO FORMATIVO [4]', application);
    application.handicapped = readCell('ALUMNO CON MINUSVALÍA', rowIndex) === 'Sí';
    application.eliteAthlete = readCell('DEPORTISTA DE ÉLITE', rowIndex) === 'Sí';
    application.scoring = readCell('SUMA BAREMO', rowIndex);
    application.waitingLists = [];
    applications.push(application);
    rowIndex++;
  }
  const slotsByList = [];
  let handicappedSlots, athleteSlots;
  for (const course of courses) {
    // NOTE: Asignación para discapacitados
    // TODO: Sacar pesos a ctes para leer de ficheros
    handicappedSlots = Math.ceil(course.slots * config.percentageHandicap * config.numSlotsBySeatHandicap);
    athleteSlots = Math.ceil(course.slots * config.percentageAthlete * config.numSlotsBySeatAthlete);
    slotsByList.push({
      code: course.code,
      schoolCode: course.schoolCode,
      courseSlots: course.slots,
      slots: course.slots - handicappedSlots - athleteSlots,
      handicappedSlots, athleteSlots,
      assignedToHandicapped: 0,
      assignedToAthletes: 0
    });
  }
  const sortCandidates = (c1, c2) => {
    if (c1.scoring != c2.scoring) {
      return c2.scoring - c1.scoring;
    } else {
      // NOTE: Si hay empate en scoring, se escoge el que más cerca esté del randomNumber, en dirección siempre creciente-modular
      if (((c1.randomNumber - randomNumber) >= 0 && (c2.randomNumber - randomNumber) >= 0) ||
        (((c1.randomNumber - randomNumber) < 0 && (c2.randomNumber - randomNumber) < 0))) {
        return c1.randomNumber - c2.randomNumber;
      } else {
        return c2.randomNumber - c1.randomNumber;
      }
    }
  }
  const coursesAssignations = {};
  const assignCourse = (options) => {
    const { slot, candidate, reason, choice, priority } = options;
    let application = applications.find(ap => ap.applicationId === candidate.applicationId);
    if (application.assignedCourse != null) {
      // NOTE: Desasignamos
      const assignees = coursesAssignations[`${application.assignedCourse.code}_${application.assignedCourse.schoolCode}`].assignees;
      let index;
      for (let i = 0; i < assignees.length; i++) {
        if (assignees[i].applicationId === application.applicationId) {
          index = i;
          break;
        }
      }
      if (index != null) {
        assignees.splice(index, 1);
      } else {
        console.error('Asignación no encontrada');
      }
      const assignedCourse = application.assignedCourse;
      delete application.assignedCourse;
      const oldSlot = slotsByList.find(s => s.code === assignedCourse.code && s.schoolCode === assignedCourse.schoolCode);
      if (oldSlot == null) {
        console.error('Slot no encontrado');
      }
      if (oldSlot['recoveredSlots']) {
        oldSlot['recoveredSlots'] += 1;
      } else {
        oldSlot['recoveredSlots'] = 1;
      }
    }


    application.assignedCourse = { ...courses.find(c => c.code === slot.code && c.schoolCode === slot.schoolCode), choice, reason };
    application.priority = priority ? 'SI' : 'NO';
    application.reason = reason;
    let optionIndex = choice - 2;
    application.waitingLists = [];
    while (optionIndex >= 0) {
      application.waitingLists.unshift({ schoolCode: application.courses[optionIndex].schoolCode, code: application.courses[optionIndex].code });
      optionIndex--;
    }
    while (application.waitingLists.length < 4) {
      application.waitingLists.push({});
    }
    candidate.assignedCourse = application.assignedCourse;
    if (!coursesAssignations[`${slot.code}_${slot.schoolCode}`]) {
      coursesAssignations[`${slot.code}_${slot.schoolCode}`] = {
        code: slot.code,
        slots: slot.slots,
        assignees: [{ ...candidate, reason, list: application.list, choice }],
      }
    } else {
      coursesAssignations[`${slot.code}_${slot.schoolCode}`].assignees.push({ ...candidate, reason, list: application.list, choice });
    }
  }
  applications.sort(sortCandidates);
  // NOTE: Discapacitados
  const handicappedCandidates = applications.filter(ap => ap.handicapped);
  let slot;
  for (const candidate of handicappedCandidates) {
    for (let i = 0; i < candidate.courses.length; i++) {
      slot = slotsByList.find(s => s.code === candidate.courses[i].code && s.schoolCode === candidate.courses[i].schoolCode);
      if (slot.handicappedSlots > 0) {
        assignCourse({
          slot,
          candidate,
          reason: 'D', // NOTE. Discapacitados
          choice: i + 1
        });
        if (candidate.especialNeeds) {
          slot.handicappedSlots -= 2;
          slot.assignedToHandicapped += 2;
        } else {
          slot.handicappedSlots--;
          slot.assignedToHandicapped++;
        }
        break;
      }
    }
  }
  // NOTE: Atletas
  const athleteCandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.eliteAthlete);
  for (const candidate of athleteCandidates) {
    for (let i = 0; i < candidate.courses.length; i++) {
      slot = slotsByList.find(s => s.code === candidate.courses[i].code && s.schoolCode === candidate.courses[i].schoolCode);
      if (slot.athleteSlots > 0) {
        assignCourse({
          slot,
          candidate,
          reason: 'E', // NOTE: Atletas de élite
          choice: i + 1
        });
        if (candidate.especialNeeds) {
          slot.athleteSlots -= 2;
          slot.assignedToAthletes += 2;
        } else {
          slot.athleteSlots--;
          slot.assignedToAthletes++;
        }
        break;
      }
    }
  }
  let remainingSlots;
  for (const slot of slotsByList) {
    remainingSlots = slot.slots + slot.handicappedSlots + slot.athleteSlots;
    slot.handicappedSlots = 0;
    slot.athleteSlots = 0;
    // TODO: Sacar pesos a ctes para leer de ficheros
    slot.otherSlots = remainingSlots;
  }
  const optionsMap = {
    1: 'CENTRO Y CICLO FORMATIVO [1]',
    2: 'CENTRO Y CICLO FORMATIVO [2]',
    3: 'CENTRO Y CICLO FORMATIVO [3]',
    4: 'CENTRO Y CICLO FORMATIVO [4]',
  }
  const candidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1'));
  for (const candidate of candidates) {
    for (const option of Object.keys(optionsMap)) {
      if (!candidate.courses[option - 1]) {
        continue;
      }
      if (candidate.assignedCourse != null && option >= candidate.assignedCourse.choice) {
        continue;
      }
      slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
      if (slot.otherSlots > 0) {
        assignCourse({
          slot,
          candidate,
          reason: 'X',
          choice: option
        });
        if (candidate.especialNeeds) {
          slot.otherSlots -= 2;
        } else {
          slot.otherSlots--;
        }
        break;
      }
    }
  }
  // NOTE: Asignamos plazas recuepradas y segunda pasada para ver si podemos mejorar la asignación de alguien
  for (const slot of slotsByList) {
    slot.otherSlots = slot.otherSlots + slot.recoveredSlots;
    slot.recoveredSlots = 0;
  }
  for (const candidate of candidates) {
    for (const option of Object.keys(optionsMap)) {
      if (!candidate.courses[option - 1]) {
        continue;
      }
      if (candidate.assignedCourse != null && option >= candidate.assignedCourse.choice) {
        continue;
      }
      slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
      if (slot.otherSlots > 0) {
        assignCourse({
          slot,
          candidate,
          reason: 'X',
          choice: option
        });
        if (candidate.especialNeeds) {
          slot.otherSlots -= 2;
        } else {
          slot.otherSlots--;
        }
        break;
      }
    }
  }
  const unassignedApplications = applications.filter(ap => ap.assignedCourse == null);
  unassignedApplications.forEach(ap => {
    ap.waitingLists = [];
    let index = 0;
    while (index < 4) {
      if (ap.courses[index] != null) {
        ap.waitingLists.push({ schoolCode: ap.courses[index].schoolCode, code: ap.courses[index].code });
      } else {
        ap.waitingLists.push({});
      }
      index++;
    }
  });

  const filename = `FPB_Admitidos_${Date.now()}`;

  // Excel
  const content = 'NUMERO SOLICITUD;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CILO;DNI;IDENTIFICACION;PUNTUACION;' +
    'NEE;MINUSVALÍA;ATLETA;MOTIVO DE ACCESO;CENTRO LISTA DE ESPERA 1;CICLO LISTA DE ESPERA 1;CENTRO LISTA DE ESPERA 2;' +
    'CICLO LISTA DE ESPERA 2;CENTRO LISTA DE ESPERA 3;CICLO LISTA DE ESPERA 3;CENTRO LISTA DE ESPERA 4;CICLO LISTA DE ESPERA 4;\r\n' +
  applications.map(ap => `${ap.applicationId};${ap.assignedCourse?.schoolCode || 'Ninguno'};${ap.assignedCourse?.school || 'Ninguno'};` +
    `${ap.assignedCourse?.code || 'Ninguno'};${ap.assignedCourse?.course || 'Ninguno'};${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'};` +
    `${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'};` +
    `${ap.scoring};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};` +
    `${ap.reason || 'Ninguno'};${ap.waitingLists[0]?.schoolCode || ''};${ap.waitingLists[0]?.code || ''};${ap.waitingLists[1]?.schoolCode || ''};` +
    `${ap.waitingLists[1]?.code || ''};${ap.waitingLists[2]?.schoolCode || ''};${ap.waitingLists[2]?.code || ''};${ap.waitingLists[3]?.schoolCode || ''};` +
    `${ap.waitingLists[3]?.code || ''};`).join('\r\n');

  fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+".csv"), content);
  
  console.log({ applications, coursesAssignations });

  // Pdf
  const contentFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'admitidos.html'), 'utf8');
  if (contentFile){
    pdfBuffer = await html_to_pdf.generatePdf({ content: contentFile }, { format: 'A4' });
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+".pdf"), pdfBuffer);
  }

  return `${filename}`;
}

module.exports = { processAssigns };
