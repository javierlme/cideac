const xlsx = require('xlsx');
const path = require('path');
const { randomNumber } = require('../constants');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

const GMPColumns = {
  ['NÚMERO DOCUMENTO DE IDENTIDAD']: 'A',
  ['NUMERO SOLICITUD']: 'B',
  ['NÚMERO ALEATORIO']: 'C',
  ['IDENTIFICACIÓN']: 'D',
  ['CENTRO Y CICLO FORMATIVO [1]']: 'E',
  ['PRIORIDAD PETICIÓN [1]']: 'F',
  ['CENTRO Y CICLO FORMATIVO [2]']: 'G',
  ['PRIORIDAD PETICIÓN [2]']: 'H',
  ['CENTRO Y CICLO FORMATIVO [3]']: 'I',
  ['PRIORIDAD PETICIÓN [3]']: 'J',
  ['CENTRO Y CICLO FORMATIVO [4]']: 'K',
  ['PRIORIDAD PETICIÓN [4]']: 'L',
  ['LISTA']: 'M',
  ['CIUDAD AUTÓNOMA O COMUNIDAD EN LA QUE SE SUPERÓ LA PRUEBA DE ACCESO']: 'N',
  ['SELECCIONE LA TITULACIÓN ELEGIDA PARA LA BAREMACIÓN']: 'O',
  ['NIVEL DE LA TITULACIÓN']: 'P',
  ['NOTA MEDIA PARA BAREMO']: 'Q',
  ['BAREMO POR ESTUDIOS EN MISMA CIUDAD']: 'R',
  ['SUMA BAREMO']: 'S',
  ['ALUMNO CON DISCAPACIDAD']: 'T',
  ['DEPORTISTA DE ÉLITE']: 'U',
};
async function processAssigns(category, city, filePath, config) {
  const courses = await courseService.getCategoryCourses(city, category);
  const wb = xlsx.readFile(
    filePath
  );
  const dataSheet = wb.SheetNames[0];
  function getCellValue(cell) {
    const cellValue = wb.Sheets[dataSheet][cell];
    return cellValue ? cellValue.w || cellValue.v.toString() || '' : '';
  }
  const readCell = (column, row) => {
    return getCellValue(`${GMPColumns[column]}${row}`);
  }
  const headerRow = 3;
  const errors = [];
  Object.keys(GMPColumns).forEach(key => {
    if (readCell(key, headerRow) != key) {
      errors.push(`Header cell ${GMPColumns[key]}${headerRow} must be ${key}`);
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
  // TODO: Modificar para que controle todos los errores  
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
      application.courses.push({ ...selectedCourse });
    }
  }
  // NOTE: Código para grado medio melilla, pendiente extender/generalizar
  while (readRow(rowIndex)) {
    application = {
      applicationId: readCell('NUMERO SOLICITUD', rowIndex),
      docId: readCell('NÚMERO DOCUMENTO DE IDENTIDAD', rowIndex),
      randomNumber: readCell('NÚMERO ALEATORIO', rowIndex),
      personalId: readCell('IDENTIFICACIÓN', rowIndex),
      courses: []
    };
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [1]', application, true);
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [2]', application);
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [3]', application);
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [4]', application);
    application.handicapped = readCell('ALUMNO CON DISCAPACIDAD', rowIndex) === 'Sí';
    application.eliteAthlete = readCell('DEPORTISTA DE ÉLITE', rowIndex) === 'Sí';
    application.scoring = readCell('SUMA BAREMO', rowIndex);
    application.list = readCell('LISTA', rowIndex)?.trim();
    if (!application.list) {
      throw {
        httpCode: 400,
        code: 'ERR_APPLICATION_WITHOUT_LIST',
        additionalInfo: {
          rowIndex,
          desc: `Solicitud ${application.applicationId} sin lista asociada en la fila ${rowIndex}`
        }
      };
    }
    if (application.list === 'B' || application.list === 'C') {
      application.priorities = [
        readCell('PRIORIDAD PETICIÓN [1]', rowIndex) === 'Sí',
        readCell('PRIORIDAD PETICIÓN [2]', rowIndex) === 'Sí',
        readCell('PRIORIDAD PETICIÓN [3]', rowIndex) === 'Sí',
        readCell('PRIORIDAD PETICIÓN [4]', rowIndex) === 'Sí',
      ];
    }
    application.waitingLists = [];
    applications.push(application);
    rowIndex++;
  }
  let slotsByList = [];
  let handicappedSlots, athleteSlots;
  for (const course of courses) {
    // NOTE: Asignación para discapacitados
    // TODO: Sacar pesos a ctes para leer de ficheros
    handicappedSlots = Math.ceil(course.slots * config.percentageHandicap * config.numSlotsBySeatHandicap);
    athleteSlots = Math.ceil(course.slots * config.percentageAthlete * config.numSlotsBySeatAthlete);
    slotsByList.push({
      schoolCode: course.schoolCode,
      code: course.code,
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
          reason: 'D', // NOTE: Discapacitados
          choice: i + 1
        });
        slot.handicappedSlots--;
        slot.assignedToHandicapped++;
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
        slot.athleteSlots--;
        slot.assignedToAthletes++;
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
    slot.ASlots = Math.ceil((remainingSlots) * 0.65);
    slot.BSlots = remainingSlots > slot.ASlots ? Math.ceil((remainingSlots) * 0.2) : 0;
    slot.CSlots = remainingSlots - slot.ASlots - slot.BSlots;
  }
  const optionsMap = {
    1: 'CENTRO Y CICLO FORMATIVO [1]',
    2: 'CENTRO Y CICLO FORMATIVO [2]',
    3: 'CENTRO Y CICLO FORMATIVO [3]',
    4: 'CENTRO Y CICLO FORMATIVO [4]',
  }
  const assignByLists = (propagateSlots) => {
    let assignmentMade = false;
    // NOTE: Lista A
    const ACandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.list === 'A');
    for (const candidate of ACandidates) {
      for (const option of Object.keys(optionsMap)) {
        if (candidate.assignedCourse != null) {
          continue;
        }
        if (!candidate.courses[option - 1]) {
          continue;
        }
        slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
        if (slot != null && slot.ASlots > 0) {
          assignCourse({
            slot,
            candidate,
            reason: 'A',
            choice: option
          });
          slot.ASlots--;
          assignmentMade = true;
        }
      }
    }
    if (propagateSlots) {
      for (const slot of slotsByList) {
        if (slot.ASlots > 0) {
          slot.BSlots += slot.ASlots;
          slot.ASlots = 0;
        }
      }
    }
    const checkCourse = (candidate, option, list, suffix, priority) => {
      if (candidate.assignedCourse != null && option >= candidate.assignedCourse.choice) {
        return false;
      }
      if (!candidate.courses[option - 1]) {
        return false;
      }
      slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
      if (slot != null && slot[`${list}Slots`] > 0) {
        assignCourse({
          slot,
          candidate,
          reason: `${list}${suffix}`,
          choice: option,
          priority
        });
        slot[`${list}Slots`]--;
        assignmentMade = true;
        return true;
      }
      return false;
    }
    const assignWithPriorityLists = (candidates, list) => {
      // NOTE: Hacemos una primera pasada atendiendo solo las solicitudes con prioridad.
      for (const candidate of candidates) {
        for (const option of Object.keys(optionsMap)) {
          if (!candidate.priorities[option - 1]) {
            continue;
          }
          if (checkCourse(candidate, option, list, '1', true)) {
            break;
          }
        }
      }
      // NOTE: Hacemos una segunda pasada atendiendo solo las solicitudes sin prioridad.
      for (const candidate of candidates) {
        for (const option of Object.keys(optionsMap)) {
          if (candidate.priorities[option - 1]) {
            // NOTE: Si ya le hemos asignado un curso y era una opción mejor o igual que la anterior, lo dejamos
            // También lo dejamos cuando el candidato tiene prioridad, ya que este caso lo habremos analizado en la iteración anterior
            continue;
          }
          if (checkCourse(candidate, option, list, '2', false)) {
            break;
          }
        }
      }
      // NOTE: Hacemos una pasada final, sin discriminar por prioridades, analizando si a algún candidato podemos asignarle algo
      for (const candidate of candidates) {
        for (const option of Object.keys(optionsMap)) {
          if (candidate.assignedCourse != null && candidate.assignedCourse.choice <= option) {
            // NOTE: Si ya le hemos asignado un curso y era una opción mejor o igual que la anterior, lo dejamos
            continue;
          }
          if (checkCourse(candidate, option, list, candidate.priorities[option - 1] ? '1' : '2', candidate.priorities[option - 1])) {
            break;
          }
        }
      }
    };
    const BCandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.list === 'B');
    assignWithPriorityLists(BCandidates, 'B');
    if (propagateSlots) {
      for (const slot of slotsByList) {
        if (slot.BSlots > 0) {
          slot.CSlots += slot.BSlots;
          slot.BSlots = 0;
        }
      }
    }
    const CCandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.list === 'C');
    assignWithPriorityLists(CCandidates, 'C');
    return assignmentMade;
  };
  let propagateSlots = false;
  while (assignByLists(propagateSlots)) { // NOTE: Iteramos hasta que, en alguna iteración, no se asigne nada.
    for (const slot of slotsByList) {
      remainingSlots = slot.ASlots + slot.BSlots + slot.CSlots + (slot['recoveredSlots'] || 0);
      slot['recoveredSlots'] = 0;
      if (remainingSlots > 0) {
        // TODO: Sacar pesos a ctes para leer de ficheros
        slot.ASlots = Math.ceil((remainingSlots) * 0.65);
        slot.BSlots = (remainingSlots === slot.ASlots) ? 0 : Math.ceil((remainingSlots) * 0.2);
        slot.CSlots = remainingSlots - slot.ASlots - slot.BSlots;
      }
    }
    propagateSlots = true;
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
  const filename = `GM_${Date.now()}.csv`;
  const content = 'NUMERO SOLICITUD;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CILO;DNI;IDENTIFICACION;VIA ACCESO (1);' +
    'LISTA PREFERENTE;PUNTUACION;MINUSVALIA;ATLETA;MOTIVO DE ACCESO;CENTRO LISTA DE ESPERA 1;CICLO LISTA DE ESPERA 1;' +
    'CENTRO LISTA DE ESPERA 2;CICLO LISTA DE ESPERA 2;CENTRO LISTA DE ESPERA 3;CICLO LISTA DE ESPERA 3;CENTRO LISTA DE ESPERA 4;CICLO LISTA DE ESPERA 4;\r\n' +
    applications.map(ap => `${ap.applicationId};${ap.assignedCourse?.schoolCode || 'Ninguno'};${ap.assignedCourse?.school || 'Ninguno'};` +
      `${ap.assignedCourse?.code || 'Ninguno'};${ap.assignedCourse?.course || 'Ninguno'};${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'};` +
      `${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'};` +
      `${ap.list};${ap.priority || ''};${ap.scoring};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};` +
      `${ap.reason || 'Ninguno'};${ap.waitingLists[0]?.schoolCode || ''};${ap.waitingLists[0]?.code || ''};${ap.waitingLists[1]?.schoolCode || ''};` +
      `${ap.waitingLists[1]?.code || ''};${ap.waitingLists[2]?.schoolCode || ''};${ap.waitingLists[2]?.code || ''};${ap.waitingLists[3]?.schoolCode || ''};` +
      `${ap.waitingLists[3]?.code || ''};`).join('\r\n');
  fs.writeFileSync(path.join(__dirname, '..', 'temp', filename), content, 'latin1');
  console.log({ applications, coursesAssignations });
  return `${filename}`;
}

module.exports = { processAssigns };
