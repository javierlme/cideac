const xlsx = require('xlsx');
const path = require('path');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');




async function processAssigns(category, city, filePath, config, distance) {
  const listaSolicitudes = [];
  const listaCentrosCiclosModulos = await courseService.getCategoryCourses(city, category);
  const wb = xlsx.readFile(filePath);
  const dataSheet = wb.SheetNames[0];
  const readCell = (column, row) => {
    const cellValue = wb.Sheets[dataSheet][`${column}${row}`];
    return cellValue ? cellValue.w || cellValue.v.toString() || '' : '';
  }
  const sortCandidates = (c1, c2) => {
    if (c1.scoring != c2.scoring) {
      return c2.scoring - c1.scoring;
    } else {
      // NOTE: Si hay empate en scoring, se escoge el que más cerca esté del randomNumber, en dirección siempre creciente-modular
      if (((c1.randomNumber - config.randomNumberSelected) >= 0 && (c2.randomNumber - config.randomNumberSelected) >= 0) ||
        (((c1.randomNumber - config.randomNumberSelected) < 0 && (c2.randomNumber - config.randomNumberSelected) < 0))) {
        return c1.randomNumber - c2.randomNumber;
      } else {
        return c2.randomNumber - c1.randomNumber;
      }
    }
  }
  let rowIndex = 2;
  let infoSolicitud;
  const validateAndAppendCourse = (field, infoSolicitud, mandatory = false) => {
    const curso = readCell(field, rowIndex);
    if (!curso) {
      if (!mandatory) {
        return;
      } else {
        throw {
          httpCode: 400,
          codigoCurso: 'ERR_MISSING_MANDATORY_COURSE',
          additionalInfo: {
            rowIndex,
            desc: `La fila ${rowIndex} no tiene ningún curso solicitado`
          }
        }
      }
    }
    const selectedCourse = listaCentrosCiclosModulos.find(c =>
      (curso.match(new RegExp(c.codigoCurso, 'i')) != null) &&
      (curso.match(new RegExp(c.codigoCentro, 'i')) != null)
    ); // NOTE: Buscamos que contenga el código del curso y el centro
    if (selectedCourse == null) {
      throw {
        httpCode: 400, codigoCurso: 'ERR_INVALID_COURSE',
        additionalInfo: {
          rowIndex,
          desc: `Curso inválido ${curso} en la fila ${rowIndex}`
        }
      };
    } else {
      infoSolicitud.listaCentrosCiclosModulos.push(selectedCourse);
    }
  }

  // Leer del excel los datos de las listaSolicitudes
  while (readCell('A', rowIndex) != '') {
    infoSolicitud = {
      docId: readCell('A', rowIndex),
      applicationId: readCell('B', rowIndex),
      randomNumber: readCell('C', rowIndex),
      personalId: readCell('D', rowIndex),
      especialNeeds: ['si','sí'].includes(readCell('E', rowIndex).toLowerCase()),
      listaCentrosCiclosModulos: []
    };  
    validateAndAppendCourse('F', infoSolicitud, true);
    validateAndAppendCourse('G', infoSolicitud);
    validateAndAppendCourse('H', infoSolicitud);
    validateAndAppendCourse('I', infoSolicitud);
    infoSolicitud.scoring = readCell('M', rowIndex);
    infoSolicitud.handicapped = ['si','sí'].includes(readCell('N', rowIndex).toLowerCase());
    infoSolicitud.eliteAthlete =  ['si','sí'].includes(readCell('O', rowIndex).toLowerCase());
    listaSolicitudes.push(infoSolicitud);
    rowIndex++;
  }

  console.log(`listaCentrosCiclosModulos.length:${listaCentrosCiclosModulos.length}`);
  console.log(`listaSolicitudes.length:${listaSolicitudes.length}`);

  // Tratar asignaciones por prioridades

  
  var listaAsignadosDiscapacitados = Array();
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    const vacantesDiscapacitados = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageHandicap * config.numSlotsBySeatHandicap);
    const vacantesDeportistasElite = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageAthlete * config.numSlotsBySeatAthlete);
    const claveCurso = (cursoCentroCicloModulo.codigoCentro || '') + "_" + (cursoCentroCicloModulo.codigoCurso || '') + "_" + (cursoCentroCicloModulo.codigoModulo || '');
    if (vacantesDiscapacitados>0){
      // Obtener la lista de discapacitados que correspondan al centro-ciclo-modulo
      listaAsignadosDiscapacitados = listaSolicitudes.filter(sol => ((sol.handicapped) 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso))).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDiscapacitados = listaAsignadosDiscapacitados.slice(0,vacantesDiscapacitados);
      cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera = listaAsignadosDiscapacitados.slice(vacantesDiscapacitados);
    }
    if (vacantesDeportistasElite>0){
        // Obtener la lista de deportista de élite que correspondan al centro-ciclo-modulo
      listaAsignadosDeportistasElite = listaSolicitudes.filter(sol => ((sol.eliteAthlete) 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso))).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = listaAsignadosDeportistasElite.slice(0,vacantesDeportistasElite);
      cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera = listaAsignadosDeportistasElite.slice(vacantesDeportistasElite);
    }
    console.log(`cursoCentroCicloModulo: ${JSON.stringify(cursoCentroCicloModulo)}`);
  }

  



  const slotsByList = [];
  let handicappedSlots, athleteSlots;
  for (const curso of listaCentrosCiclosModulos) {
    handicappedSlots = Math.ceil(curso.vacantes * config.percentageHandicap * config.numSlotsBySeatHandicap);
    athleteSlots = Math.ceil(curso.vacantes * config.percentageAthlete * config.numSlotsBySeatAthlete);
    slotsByList.push({
      codigoCurso: curso.codigoCurso,
      codigoCentro: curso.codigoCentro,
      courseSlots: curso.vacantes,
      vacantes: curso.vacantes - handicappedSlots - athleteSlots,
      handicappedSlots, athleteSlots,
      assignedToHandicapped: 0,
      assignedToAthletes: 0
    });
  }
  const coursesAssignations = {};
  const assignCourse = (options) => {
    const { slot, candidate, reason, choice, priority } = options;
    let infoSolicitud = listaSolicitudes.find(ap => ap.applicationId === candidate.applicationId);
    if (infoSolicitud.assignedCourse != null) {
      // NOTE: Desasignamos
      const assignees = coursesAssignations[`${infoSolicitud.assignedCourse.codigoCurso}_${infoSolicitud.assignedCourse.codigoCentro}`].assignees;
      let index;
      for (let i = 0; i < assignees.length; i++) {
        if (assignees[i].applicationId === infoSolicitud.applicationId) {
          index = i;
          break;
        }
      }
      if (index != null) {
        assignees.splice(index, 1);
      } else {
        console.error('Asignación no encontrada');
      }
      const assignedCourse = infoSolicitud.assignedCourse;
      delete infoSolicitud.assignedCourse;
      const oldSlot = slotsByList.find(s => s.codigoCurso === assignedCourse.codigoCurso && s.codigoCentro === assignedCourse.codigoCentro);
      if (oldSlot == null) {
        console.error('Slot no encontrado');
      }
      if (oldSlot['recoveredSlots']) {
        oldSlot['recoveredSlots'] += 1;
      } else {
        oldSlot['recoveredSlots'] = 1;
      }
    }


    infoSolicitud.assignedCourse = { ...listaCentrosCiclosModulos.find(c => c.codigoCurso === slot.codigoCurso && c.codigoCentro === slot.codigoCentro), choice, reason };
    infoSolicitud.priority = priority ? 'SI' : 'NO';
    infoSolicitud.reason = reason;
    let optionIndex = choice - 2;
    infoSolicitud.waitingLists = [];
    while (optionIndex >= 0) {
      infoSolicitud.waitingLists.unshift({ codigoCentro: infoSolicitud.listaCentrosCiclosModulos[optionIndex].codigoCentro, codigoCurso: infoSolicitud.listaCentrosCiclosModulos[optionIndex].codigoCurso });
      optionIndex--;
    }
    while (infoSolicitud.waitingLists.length < 4) {
      infoSolicitud.waitingLists.push({});
    }
    candidate.assignedCourse = infoSolicitud.assignedCourse;
    if (!coursesAssignations[`${slot.codigoCurso}_${slot.codigoCentro}`]) {
      coursesAssignations[`${slot.codigoCurso}_${slot.codigoCentro}`] = {
        codigoCurso: slot.codigoCurso,
        slots: slot.slots,
        assignees: [{ ...candidate, reason, list: infoSolicitud.list, choice }],
      }
    } else {
      coursesAssignations[`${slot.codigoCurso}_${slot.codigoCentro}`].assignees.push({ ...candidate, reason, list: infoSolicitud.list, choice });
    }
  }
  listaSolicitudes.sort(sortCandidates);
  // NOTE: Discapacitados
  const handicappedCandidates = listaSolicitudes.filter(ap => ap.handicapped);
  let slot;
  for (const candidate of handicappedCandidates) {
    for (let i = 0; i < candidate.listaCentrosCiclosModulos.length; i++) {
      slot = slotsByList.find(s => s.codigoCurso === candidate.listaCentrosCiclosModulos[i].codigoCurso && s.codigoCentro === candidate.listaCentrosCiclosModulos[i].codigoCentro);
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
  const athleteCandidates = listaSolicitudes.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1') && ap.eliteAthlete);
  for (const candidate of athleteCandidates) {
    for (let i = 0; i < candidate.listaCentrosCiclosModulos.length; i++) {
      slot = slotsByList.find(s => s.codigoCurso === candidate.listaCentrosCiclosModulos[i].codigoCurso && s.codigoCentro === candidate.listaCentrosCiclosModulos[i].codigoCentro);
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
  const candidates = listaSolicitudes.filter(ap => (ap.assignedCourse == null || ap.assignedCourse.choice != '1'));
  for (const candidate of candidates) {
    for (const option of Object.keys(optionsMap)) {
      if (!candidate.listaCentrosCiclosModulos[option - 1]) {
        continue;
      }
      if (candidate.assignedCourse != null && option >= candidate.assignedCourse.choice) {
        continue;
      }
      slot = slotsByList.find(s => s.codigoCurso === candidate.listaCentrosCiclosModulos[option - 1].codigoCurso && s.codigoCentro === candidate.listaCentrosCiclosModulos[option - 1].codigoCentro);
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
  // NOTE: Asignamos plazas recuperadas y segunda pasada para ver si podemos mejorar la asignación de alguien
  for (const slot of slotsByList) {
    slot.otherSlots = slot.otherSlots + slot.recoveredSlots;
    slot.recoveredSlots = 0;
  }
  for (const candidate of candidates) {
    for (const option of Object.keys(optionsMap)) {
      if (!candidate.listaCentrosCiclosModulos[option - 1]) {
        continue;
      }
      if (candidate.assignedCourse != null && option >= candidate.assignedCourse.choice) {
        continue;
      }
      slot = slotsByList.find(s => s.codigoCurso === candidate.listaCentrosCiclosModulos[option - 1].codigoCurso && s.codigoCentro === candidate.listaCentrosCiclosModulos[option - 1].codigoCentro);
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
  const unassignedApplications = listaSolicitudes.filter(ap => ap.assignedCourse == null);
  unassignedApplications.forEach(ap => {
    ap.waitingLists = [];
    let index = 0;
    while (index < 4) {
      if (ap.listaCentrosCiclosModulos[index] != null) {
        ap.waitingLists.push({ codigoCentro: ap.listaCentrosCiclosModulos[index].codigoCentro, codigoCurso: ap.listaCentrosCiclosModulos[index].codigoCurso });
      } else {
        ap.waitingLists.push({});
      }
      index++;
    }
  });

/*
  // Excel
  const content = 'NUMERO SOLICITUD;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CICLO;DNI;IDENTIFICACION;PUNTUACION;' +
    'NEE;MINUSVALÍA;ATLETA;MOTIVO DE ACCESO;CENTRO LISTA DE ESPERA 1;CICLO LISTA DE ESPERA 1;CENTRO LISTA DE ESPERA 2;' +
    'CICLO LISTA DE ESPERA 2;CENTRO LISTA DE ESPERA 3;CICLO LISTA DE ESPERA 3;CENTRO LISTA DE ESPERA 4;CICLO LISTA DE ESPERA 4;\r\n' +
  listaSolicitudes.map(ap => `${ap.applicationId};${ap.assignedCourse?.codigoCentro || 'Ninguno'};${ap.assignedCourse?.centro || 'Ninguno'};` +
    `${ap.assignedCourse?.codigoCurso || 'Ninguno'};${ap.assignedCourse?.curso || 'Ninguno'};${ap.docId ? `${ap.docId}` : 'Ninguno'};` +
    `${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'};` +
    `${ap.scoring};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};` +
    `${ap.reason || 'Ninguno'};${ap.waitingLists[0]?.codigoCentro || ''};${ap.waitingLists[0]?.codigoCurso || ''};${ap.waitingLists[1]?.codigoCentro || ''};` +
    `${ap.waitingLists[1]?.codigoCurso || ''};${ap.waitingLists[2]?.codigoCentro || ''};${ap.waitingLists[2]?.codigoCurso || ''};${ap.waitingLists[3]?.codigoCentro || ''};` +
    `${ap.waitingLists[3]?.codigoCurso || ''};`).join('\r\n');

  fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Admitidos.csv"), content);

  console.log({ listaSolicitudes, coursesAssignations });
*/
  const filename = `GB_${Date.now()}_`;
  var contentAdmitidosExcel = 'ORDEN;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CICLO;DNI;IDENTIFICACION;PUNTUACION;' +
  'NEE;MINUSVALÍA;ATLETA;\r\n';
  const contentHeaderFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'headerBase.html'));
  const admitidosBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'admitidosBase.html'));
  const esperaBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'esperaBase.html'));
  if (contentHeaderFile && admitidosBaseHtml && esperaBaseHtml){
    let html = contentHeaderFile.toString();
    const numLinesPerPage = 50;
    var pag=1;
    for (i=0; i<listaCentrosCiclosModulos.length; i++){
      var order=0;
      curso = listaCentrosCiclosModulos[i];
      console.log(JSON.stringify(curso))
      const selectedCourse = coursesAssignations[String(curso.codigoCurso+'_'+curso.codigoCentro)];
      if (!selectedCourse) return;
      selectedCourse.assignees.map(ap => {
        if (order%numLinesPerPage==0){
          html += admitidosBaseHtml.toString()
          .replace('##titleGeneral##', config.titleGeneral)
          .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
          .replace('##city##', city)
          .replace('##titleCurse##', config.titleCurse)
          .replace('##titleAdmitted##', config.titleAdmitted)
          .replace('##centro##', ap.assignedCourse.centro)
          .replace('##curso##', ap.assignedCourse.curso)
          .replace('##textGBTypeGeneral##', config.textGBTypeGeneral)
          .replace('##titleWarning##', config.titleWarning)
        }  
        html += `  <tr style="background-color:${(order++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
        html += `   <td class="width:15%;text-align:left;">${(order)}</td>`;
        html += `	  <td class="width:60%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
        html += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
        html += `	  <td class="width:10%;text-align:center;">${ap.scoring}</td>`;
        html += `  </tr>`;
        contentAdmitidosExcel+= `${(order || '')};${(ap.assignedCourse.codigoCentro || '')};${(ap.assignedCourse.centro || '')};`
          +`${(ap.assignedCourse.codigoCurso || '')};${(ap.assignedCourse.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
          + `${(ap.scoring || '')};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
        if (order%numLinesPerPage==0){
          html += '</table>';
          html += `<div style="page-break-after:always"></div>`;
        }
      });
      html += `</table>`;
      html += `<div style="page-break-after:always"></div>`;
    }
    html += `</body>`;
    html += `</html>`;
    contentAdmitidosPdf = await html_to_pdf.generatePdf({ content: html }, 
    { 
        format: 'A4',
        displayHeaderFooter: true,
        footerTemplate: '<style>span{width:100% !important;text-align:center !important;font-size:8px !important;font-family: "Calibri"; }</style><span>Página <label class="pageNumber"></label> de <label class="totalPages"> </label> </span>',
        margin: {
          top: "0px",
          bottom: "50px",
          right: "0px",
          left: "0px",
        }
    });
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Admitidos.pdf"), contentAdmitidosPdf);
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Admitidos.csv"), contentAdmitidosExcel, 'latin1');


    // Listado de esperas

    const contentEspera = 'NUMERO SOLICITUD;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CILO;DNI;IDENTIFICACION;PUNTUACION;' +
    'NEE;MINUSVALÍA;ATLETA;MOTIVO DE ACCESO;CENTRO LISTA DE ESPERA 1;CICLO LISTA DE ESPERA 1;CENTRO LISTA DE ESPERA 2;' +
    'CICLO LISTA DE ESPERA 2;CENTRO LISTA DE ESPERA 3;CICLO LISTA DE ESPERA 3;CENTRO LISTA DE ESPERA 4;CICLO LISTA DE ESPERA 4;\r\n';
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Espera.csv"), contentEspera);
  
  }

  return `${filename}`;
}

module.exports = { processAssigns };
