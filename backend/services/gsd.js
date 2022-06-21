const xlsx = require('xlsx');
const path = require('path');
const { randomNumber } = require('../constants');
const courseService = require('../routers/courses');
const fs = require('fs');

const GSDColumns = {
  ['NÚMERO DOCUMENTO DE IDENTIDAD']: 'A',
  ['NUMERO SOLICITUD']: 'B',
  ['NÚMERO ALEATORIO']: 'C',
  ['IDENTIFICACIÓN']: 'D',
  ['CIUDAD AUTÓNOMA O COMUNIDAD EN LA QUE SE SUPERÓ LA PRUEBA DE ACCESO']: 'E',
  ['SELECCIONE LA TITULACIÓN ELEGIDA PARA LA BAREMACIÓN']: 'F',
  ['NIVEL DE LA TITULACIÓN']: 'G',
  ['LISTA']: 'H',
  ['CENTRO Y CICLO FORMATIVO [1]']: 'I',
  ['CURSO COMPLETO O MÓDULOS SUELTOS DEL CICLO [1]']: 'J',
  ['1-1']: 'K',
  ['1-2']: 'L',
  ['1-3']: 'M',
  ['1-4']: 'N',
  ['1-5']: 'O',
  ['1-6']: 'P',
  ['1-7']: 'Q',
  ['1-8']: 'R',
  ['1-9']: 'S',
  ['1-10']: 'T',
  ['PRIORIDAD PETICIÓN [1]']: 'U',
  ['ASIGNAR HORAS 2º CURSO [1]']: 'V',
  ['CENTRO Y CICLO FORMATIVO [2]']: 'W',
  ['CURSO COMPLETO O MÓDULOS SUELTOS DEL CICLO [2]']: 'X',
  ['2-1']: 'Y',
  ['2-2']: 'Z',
  ['2-3']: 'AA',
  ['2-4']: 'AB',
  ['2-5']: 'AC',
  ['2-6']: 'AD',
  ['2-7']: 'AE',
  ['2-8']: 'AF',
  ['2-9']: 'AG',
  ['2-10']: 'AH',
  ['PRIORIDAD PETICIÓN [2]']: 'AI',
  ['ASIGNAR HORAS 2º CURSO [2]']: 'AJ',
  ['CENTRO Y CICLO FORMATIVO [3]']: 'AK',
  ['CURSO COMPLETO O MÓDULOS SUELTOS DEL CICLO [3]']: 'AL',
  ['3-1']: 'AM',
  ['3-2']: 'AN',
  ['3-3']: 'AO',
  ['3-4']: 'AP',
  ['3-5']: 'AQ',
  ['3-6']: 'AR',
  ['3-7']: 'AS',
  ['3-8']: 'AT',
  ['3-9']: 'AU',
  ['3-10']: 'AV',
  ['PRIORIDAD PETICIÓN [3]']: 'AW',
  ['ASIGNAR HORAS 2º CURSO [3]']: 'AX',
  ['CENTRO Y CICLO FORMATIVO [4]']: 'AY',
  ['CURSO COMPLETO O MÓDULOS SUELTOS DEL CICLO [4]']: 'AZ',
  ['4-1']: 'BA',
  ['4-2']: 'BB',
  ['4-3']: 'BC',
  ['4-4']: 'BD',
  ['4-5']: 'BE',
  ['4-6']: 'BF',
  ['4-7']: 'BG',
  ['4-8']: 'BH',
  ['4-9']: 'BI',
  ['4-10']: 'BJ',
  ['PRIORIDAD PETICIÓN [4]']: 'BK',
  ['ASIGNAR HORAS 2º CURSO [4]']: 'BL',
  ['NOTA MEDIA PARA BAREMO']: 'BM',
  ['BAREMO POR ESTUDIOS EN MISMA CIUDAD']: 'BN',
  ['SUMA BAREMO']: 'BO',
  ['ACTIVO LABORALMENTE']: 'BP',
  ['ALUMNO CON MINUSVALÍA']: 'BQ',
  ['DEPORTISTA DE ÉLITE']: 'BR',
};
async function processAssigns(category, city, filePath) {
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
    return getCellValue(`${GSDColumns[column]}${row}`);
  }
  const headerRow = 3;
  const errors = [];
  Object.keys(GSDColumns).forEach(key => {
    if (readCell(key, headerRow) != key) {
      errors.push(`Header cell ${GSDColumns[key]}${headerRow} must be ${key}`);
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
  const validateAndAppendCourse = (field, modulesField, application, mandatory = false) => {
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
      let complete = readCell(`CURSO COMPLETO O MÓDULOS SUELTOS DEL CICLO [${application.courses.length + 1}]`, rowIndex) === 'Primer curso completo';
      let assignSecondGrade = readCell(`ASIGNAR HORAS 2º CURSO [${application.courses.length + 1}]`, rowIndex) === 'SI';
      let applicationCourse = { ...selectedCourse, complete, rowIndex };
      let selectedModule;
      if (!complete) {
        applicationCourse.modules = [];
        let module;
        for (let i = 1; i <= 10; i++) {
          module = readCell(`${modulesField}-${i}`, rowIndex);
          if (module.indexOf('#') != -1) {
            module = module.substr(0, module.indexOf('#'));
            selectedModule = selectedCourse.modules.find(m => m.code === module);
            if (!selectedModule) {
              throw {
                httpCode: 400, code: 'ERR_INVALID_COURSE',
                additionalInfo: {
                  rowIndex,
                  desc: `Curso inválido ${course} en la fila ${rowIndex} - Módulo ${module} no encontrado`
                }
              };
            }
            if (!assignSecondGrade && selectedModule.grade != '1') {
              // throw {
              //   httpCode: 400, code: 'ERR_INVALID_COURSE',
              //   additionalInfo: {
              //     rowIndex,
              //     desc: `El módulo ${module} seleccionado en la fila ${rowIndex} es de segundo grado, y el alumno no puede solicitarlo`
              //   }
              // };
            } else {
              applicationCourse.modules.push(module);
            }
          } else {
            applicationCourse.modules.push('');
          }
        }
        if (applicationCourse.modules.filter(el => el != '').length === 0) {
          throw {
            httpCode: 400, code: 'ERR_INVALID_COURSE',
            additionalInfo: {
              rowIndex,
              desc: `La solicitud ${modulesField} de la fila ${rowIndex} no incluye ningún módulo válido`
            }
          };
        }
      }
      application.courses.push(applicationCourse);
    }
  }
  // NOTE: Código para grado medio melilla, pendiente extender/generalizar
  while (readRow(rowIndex)) {
    application = {
      rowIndex,
      applicationId: readCell('NUMERO SOLICITUD', rowIndex),
      docId: readCell('NÚMERO DOCUMENTO DE IDENTIDAD', rowIndex),
      randomNumber: readCell('NÚMERO ALEATORIO', rowIndex),
      personalId: readCell('IDENTIFICACIÓN', rowIndex),
      courses: []
    };
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [1]', '1', application, true);
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [2]', '2', application);
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [3]', '3', application);
    validateAndAppendCourse('CENTRO Y CICLO FORMATIVO [4]', '4', application);
    application.handicapped = readCell('ALUMNO CON MINUSVALÍA', rowIndex) === 'Sí';
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
    application.priorities = [
      readCell('PRIORIDAD PETICIÓN [1]', rowIndex) === 'Sí',
      readCell('PRIORIDAD PETICIÓN [2]', rowIndex) === 'Sí',
      readCell('PRIORIDAD PETICIÓN [3]', rowIndex) === 'Sí',
      readCell('PRIORIDAD PETICIÓN [4]', rowIndex) === 'Sí',
    ];
    application.waitingLists = [];
    applications.push(application);
    rowIndex++;
  }
  let slotsByList = [];
  let handicappedSlots, athleteSlots;
  for (const course of courses) {
    // NOTE: Asignación para discapacitados
    // TODO: Sacar pesos a ctes para leer de ficheros
    // handicappedSlots = Math.ceil(course.slots * 0.05);
    // athleteSlots = Math.ceil(course.slots * 0.05);
    // slotsByList.push({
    //   code: course.code,
    //   schoolCode: course.schoolCode,
    //   courseSlots: course.slots,
    //   slots: course.slots - handicappedSlots - athleteSlots,
    //   handicappedSlots, athleteSlots,
    //   assignedToHandicapped: 0,
    //   assignedToAthletes: 0
    // });
    handicappedSlots = course.modules.map(m => {
      return {
        ...m,
        slots: Math.ceil(0.05 * m.slots)
      };
    });
    athleteSlots = course.modules.map(m => {
      return {
        ...m,
        slots: Math.ceil(0.05 * m.slots)
      };
    });
    slotsByList.push({
      schoolCode: course.schoolCode,
      code: course.code,
      // courseSlots: course.slots,
      // slots: course.slots - handicappedSlots - athleteSlots,
      slots: course.modules.map((m, index) => {
        return {
          ...m,
          slots: m.slots - handicappedSlots[index].slots - athleteSlots[index].slots
        }
      }),
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
  const checkAndAssignCourse = (options) => {
    const { slot, slotList, candidate, reason, choice, priority } = options;
    if (candidate.assignedCourse != null && (+choice - 1) >= candidate.assignedCourse.choice) {
      return false;
    }
    if (!candidate.courses[+choice - 1]) {
      return false;
    }
    let application = applications.find(ap => ap.applicationId === candidate.applicationId);
    let course = courses.find(c => c.code === slot.code && c.schoolCode === slot.schoolCode);
    if (application.courses[+choice - 1].complete) {
      if (!slot[slotList].every(m => m.slots > 0)) {
        return false;
      }
    } else {
      let available = true, moduleSlot;
      for (let module of application.courses[+choice - 1].modules) {
        if (module === '') {
          continue;
        }
        moduleSlot = slot[slotList].find(m => m.code === module);
        if (!moduleSlot || moduleSlot <= 0) {
          available = false;
          break;
        }
      }
      if (!available) {
        return false;
      }
    }
    application.reason = reason;
    let optionIndex = +choice - 2; // NOTE: La anterior a la asignada, si la hubiera
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
      if (!oldSlot.recoveredSlots) {
        oldSlot.recoveredSlots = oldSlot.ASlots.map(s => { return { ...s, slots: 0 } });
      }
      let moduleSlot;
      assignedCourse.modules.forEach(m => {
        moduleSlot = oldSlot.recoveredSlots.find(rs => rs.code === m.code);
        if (moduleSlot != null) {
          moduleSlot.slots++;
        } else {
          console.error('modulo no encontrado');
        }
      });
    }
    application.assignedCourse = { ...course, choice, reason };
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
    if (application.courses[+choice - 1].complete) {
      slot[slotList].forEach(m => m.slots--);
    } else {
      application.assignedCourse.modules = application.assignedCourse.modules.filter(m => application.courses[+choice - 1].modules.includes(m.code));
      for (let module of application.courses[+choice - 1].modules) {
        if (module === '') {
          continue;
        }
        moduleSlot = slot[slotList].find(m => m.code === module);
        if (moduleSlot) {
          moduleSlot.slots--;
        }
      }
    }
    return true;
  }
  applications.sort(sortCandidates);
  // NOTE: Discapacitados
  const handicappedCandidates = applications.filter(ap => ap.handicapped);
  let slot;
  for (const candidate of handicappedCandidates) {
    for (let i = 0; i < candidate.courses.length; i++) {
      slot = slotsByList.find(s => s.code === candidate.courses[i].code && s.schoolCode === candidate.courses[i].schoolCode);
      if (checkAndAssignCourse({
        slot,
        candidate,
        slotList: 'handicappedSlots',
        reason: 'D', // NOTE: Discapacitados
        choice: i + 1
      })) {
        break;
      }
      // if (slot.handicappedSlots > 0) {
      //   assignCourse({
      //     slot,
      //     candidate,
      //     reason: 'D', // NOTE: Discapacitados
      //     choice: i + 1
      //   });
      //   slot.handicappedSlots--;
      //   slot.assignedToHandicapped++;
      //   break;
      // }
    }
  }
  // NOTE: Atletas
  const athleteCandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.eliteAthlete);
  for (const candidate of athleteCandidates) {
    for (let i = 0; i < candidate.courses.length; i++) {
      slot = slotsByList.find(s => s.code === candidate.courses[i].code && s.schoolCode === candidate.courses[i].schoolCode);
      if (checkAndAssignCourse({
        slot,
        candidate,
        slotList: 'athleteSlots',
        reason: 'E', // NOTE: Discapacitados
        choice: i + 1
      })) {
        break;
      }
      // if (slot.athleteSlots > 0) {
      //   assignCourse({
      //     slot,
      //     candidate,
      //     reason: 'E', // NOTE: Atletas de élite
      //     choice: i + 1
      //   });
      //   slot.athleteSlots--;
      //   slot.assignedToAthletes++;
      //   break;
      // }
    }
  }
  let remainingSlots, course;
  for (const slot of slotsByList) {
    course = courses.find(c => c.code === slot.code && c.schoolCode === slot.schoolCode);
    if (course == null) {
      throw {
        httpCode: 400,
        code: 'ERR_COURSE_NOT_FOUND',
        additionalInfo: {
          ...slot,
        }
      };
    }
    // remainingSlots = slot.slots + slot.handicappedSlots + slot.athleteSlots;
    // slot.handicappedSlots = 0;
    // slot.athleteSlots = 0;
    remainingSlots = course.modules.map((m, index) => {
      return {
        ...m,
        slots: slot.slots[index].slots + slot.handicappedSlots[index].slots + slot.athleteSlots[index].slots
      };
    });
    slot.handicappedSlots = course.modules.map(_el => 0);
    slot.athleteSlots = course.modules.map(_el => 0);
    // TODO: Sacar pesos a ctes para leer de ficheros
    // slot.ASlots = Math.ceil((remainingSlots) * 0.65);
    // slot.BSlots = Math.ceil((remainingSlots) * 0.2);
    // slot.CSlots = remainingSlots - slot.ASlots - slot.BSlots;
    slot.ASlots = remainingSlots.map(s => {
      return { ...s, slots: Math.ceil(s.slots * 0.65) };
    });
    slot.BSlots = remainingSlots.map((s, index) => {
      return { ...s, slots: slot.ASlots[index].slots < s.slots ? Math.ceil(s.slots * 0.2) : 0 };
    });
    slot.CSlots = remainingSlots.map((s, index) => {
      return { ...s, slots: s.slots - slot.ASlots[index].slots - slot.BSlots[index].slots }
    });
    console.log(slot.code);
  }
  const optionsMap = {
    1: 'CENTRO Y CICLO FORMATIVO [1]',
    2: 'CENTRO Y CICLO FORMATIVO [2]',
    3: 'CENTRO Y CICLO FORMATIVO [3]',
    4: 'CENTRO Y CICLO FORMATIVO [4]',
  };
  const assignByLists = (propagateSlots) => {
    let assignmentMade = false;
    // const checkCourse = (candidate, option, list, suffix, priority) => {
    //   if (candidate.assignedCourse != null && option >= candidate.assignedCourse.choice) {
    //     return false;
    //   }
    //   if (!candidate.courses[option - 1]) {
    //     return false;
    //   }
    //   slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
    //   if (slot != null && slot[`${list}Slots`] > 0) {
    //     assignCourse({
    //       slot,
    //       candidate,
    //       reason: `${list}${suffix}`,
    //       choice: option,
    //       priority
    //     });
    //     slot[`${list}Slots`]--;
    //     assignmentMade = true;
    //     return true;
    //   }
    //   return false;
    // }
    const assignWithPriorityLists = (candidates, list) => {
      // NOTE: Hacemos una primera pasada atendiendo solo las solicitudes con prioridad.
      for (const candidate of candidates) {
        for (const option of Object.keys(optionsMap)) {
          if (!candidate.priorities[option - 1]) {
            continue;
          }
          slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
          if (checkAndAssignCourse({
            slot,
            candidate,
            reason: `${list}1`,
            choice: option,
            priority: true,
            slotList: `${list}Slots`,
            reason: list, // NOTE: Discapacitados
            choice: option
          })) {
            assignmentMade = true;
            break;
          }
          // if (checkCourse(candidate, option, list, '1', true)) {
          //   break;
          // }
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
          if (+option > candidate.courses.length) {
            continue;
          }
          slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
          if (checkAndAssignCourse({
            slot,
            candidate,
            reason: `${list}2`,
            choice: option,
            priority: true,
            slotList: `${list}Slots`,
            reason: list, // NOTE: Discapacitados
            choice: option
          })) {
            assignmentMade = true;
            break;
          }
          // if (checkCourse(candidate, option, list, '2', false)) {
          //   break;
          // }
        }
      }
      // NOTE: Hacemos una pasada final, sin discriminar por prioridades, analizando si a algún candidato podemos asignarle algo
      for (const candidate of candidates) {
        for (const option of Object.keys(optionsMap)) {
          if (candidate.assignedCourse != null && candidate.assignedCourse.choice <= option) {
            // NOTE: Si ya le hemos asignado un curso y era una opción mejor o igual que la anterior, lo dejamos
            continue;
          }
          if (+option > candidate.courses.length) {
            continue;
          }
          slot = slotsByList.find(s => s.code === candidate.courses[option - 1].code && s.schoolCode === candidate.courses[option - 1].schoolCode);
          if (checkAndAssignCourse({
            slot,
            candidate,
            reason: `${list}${candidate.priorities[option - 1] ? '1' : '2'}`,
            choice: option,
            priority: candidate.priorities[option - 1],
            slotList: `${list}Slots`,
            reason: list, // NOTE: Discapacitados
            choice: option
          })) {
            assignmentMade = true;
            break;
          }
          // if (checkCourse(candidate, option, list, candidate.priorities[option - 1] ? '1' : '2', candidate.priorities[option - 1])) {
          //   break;
          // }
        }
      }
    };
    // NOTE: Lista A
    const ACandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.list === 'A');
    assignWithPriorityLists(ACandidates, 'A');
    if (propagateSlots) {
      for (const slot of slotsByList) {
        slot.ASlots.forEach((s, index) => {
          slot.BSlots[index].slots += s.slots;
          s.slots = 0;
        });
      }
    }
    const BCandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.list === 'B');
    assignWithPriorityLists(BCandidates, 'B');
    if (propagateSlots) {
      for (const slot of slotsByList) {
        slot.BSlots.forEach((s, index) => {
          slot.CSlots[index].slots += s.slots;
          s.slots = 0;
        });
      }
    }
    const CCandidates = applications.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.list === 'C');
    assignWithPriorityLists(CCandidates, 'C');
    return assignmentMade;
  };
  let propagateSlots = false;
  let MAX_ROUNDS = 5;
  while (MAX_ROUNDS > 0 && assignByLists(propagateSlots)) { // NOTE: Iteramos hasta que, en alguna iteración, no se asigne nada.
    MAX_ROUNDS--;
    pendingSlots = [];
    for (const slot of slotsByList) {
      // remainingSlots = slot.ASlots + slot.BSlots + slot.CSlots + (slot['recoveredSlots'] || 0);
      remainingSlots = slot.ASlots.map((s, index) => {
        return { ...s, slots: s.slots + slot.BSlots[index].slots + slot.CSlots[index].slots + (slot.recoveredSlots?.[index]?.slots || 0) }
      });
      slot.recoveredSlots = remainingSlots.map(s => { return { ...s, slots: 0 } });
      // slot.recoveredSlots = 0;
      // if (remainingSlots > 0) {
      if (remainingSlots.some(s => s.slots > 0)) {
        // TODO: Sacar pesos a ctes para leer de ficheros
        slot.ASlots = remainingSlots.map(s => {
          return { ...s, slots: Math.ceil(s.slots * 0.65) };
        });
        slot.BSlots = remainingSlots.map((s, index) => {
          return { ...s, slots: slot.ASlots[index].slots < s.slots ? Math.ceil(s.slots * 0.2) : 0 };
        });
        slot.CSlots = remainingSlots.map((s, index) => {
          return { ...s, slots: s.slots - slot.ASlots[index].slots - slot.BSlots[index].slots }
        });
        console.log(slot.code);
        // TODO: Sacar pesos a ctes para leer de ficheros
        // slot.ASlots = Math.ceil((remainingSlots) * 0.65);
        // slot.BSlots = (remainingSlots === slot.ASlots) ? 0 : Math.ceil((remainingSlots) * 0.2);
        // slot.CSlots = remainingSlots - slot.ASlots - slot.BSlots;
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
  const filename = `GSD_${Date.now()}.csv`;
  // const content = 'NUMERO SOLICITUD;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CILO;DNI;IDENTIFICACION;VIA ACCESO (1);LISTA PREFERENTE;' +
  //   'PUNTUACION;MINUSVALIA;ATLETA;MOTIVO DE ACCESO;CENTRO LISTA DE ESPERA 1;CICLO LISTA DE ESPERA 1;CENTRO LISTA DE ESPERA 2;CICLO LISTA DE ESPERA 2;' +
  //   'CENTRO LISTA DE ESPERA 3;CICLO LISTA DE ESPERA 3;CENTRO LISTA DE ESPERA 4;CICLO LISTA DE ESPERA 4;\r\n' +
  //   applications.map(ap => `${ap.applicationId};${ap.assignedCourse?.schoolCode || 'Ninguno'};${ap.assignedCourse?.school || 'Ninguno'};` +
  //     `${ap.assignedCourse?.code || 'Ninguno'};${ap.assignedCourse?.course || 'Ninguno'};${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'};` +
  //     `${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'};` +
  //     `${ap.list};${ap.priority || ''};${ap.scoring};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};` +
  //     `${ap.reason || 'Ninguno'};${ap.waitingLists[0]?.schoolCode || ''}; ${ap.waitingLists[0]?.code || ''};${ap.waitingLists[1]?.schoolCode || ''}; ${ap.waitingLists[1]?.code || ''};${ap.waitingLists[2]?.schoolCode || ''}; ${ap.waitingLists[2]?.code || ''};${ap.waitingLists[3]?.schoolCode || ''}; ${ap.waitingLists[3]?.code || ''};`).join('\r\n');
  // fs.writeFileSync(path.join(__dirname, '..', 'temp', filename), content, 'latin1');
  // console.log({ applications, coursesAssignations });
  const content = 'NUMERO SOLICITUD;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CICLO;' +
    'MODULO 1;MODULO 2;MODULO 3;MODULO 4;MODULO 5;MODULO 6;MODULO 7;MODULO 8;MODULO 9;MODULO 10;' +
    'DNI;IDENTIFICACION;VIA ACCESO (1);' +
    'LISTA PREFERENTE;PUNTUACION;MINUSVALIA;ATLETA;MOTIVO DE ACCESO;CENTRO LISTA DE ESPERA 1;CICLO LISTA DE ESPERA 1;' +
    'CENTRO LISTA DE ESPERA 2;CICLO LISTA DE ESPERA 2;CENTRO LISTA DE ESPERA 3;CICLO LISTA DE ESPERA 3;CENTRO LISTA DE ESPERA 4;CICLO LISTA DE ESPERA 4;\r\n' +
    applications.map(ap => `${ap.applicationId};${ap.assignedCourse?.schoolCode || 'Ninguno'};${ap.assignedCourse?.school || 'Ninguno'};` +
      `${ap.assignedCourse?.code || 'Ninguno'};${ap.assignedCourse?.course || 'Ninguno'};` +
      `${ap.assignedCourse?.modules?.[0]?.code || ''};${ap.assignedCourse?.modules?.[1]?.code || ''};${ap.assignedCourse?.modules?.[2]?.code || ''};${ap.assignedCourse?.modules?.[3]?.code || ''};` +
      `${ap.assignedCourse?.modules?.[4]?.code || ''};${ap.assignedCourse?.modules?.[5]?.code || ''};${ap.assignedCourse?.modules?.[6]?.code || ''};${ap.assignedCourse?.modules?.[7]?.code || ''};` +
      `${ap.assignedCourse?.modules?.[8]?.code || ''};${ap.assignedCourse?.modules?.[9]?.code || ''};` +
      `${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'};` +
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
