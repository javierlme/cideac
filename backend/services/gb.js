const xlsx = require('xlsx');
const path = require('path');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

async function processAssigns(category, city, filePath, config) {
  const listaSolicitudesAceptadas = Array();
  const listaSolicitudesNoAceptadas = Array();
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

  const generarTextoExclusionGB = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo+=config.textGBR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo+=config.textGBR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo+=config.textGBR3 + ' / ';
    return motivo.slice(0,-2)
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
      const centrosCiclosModulo = {
        codigoCentro: selectedCourse.codigoCentro,
        centro: selectedCourse.centro,
        codigoCurso: selectedCourse.codigoCurso,
        curso: selectedCourse.curso
      }
      infoSolicitud.listaCentrosCiclosModulos.push(centrosCiclosModulo);
    }
  }

  // Leer del excel los datos de las listaSolicitudesAceptadas
  while (readCell('A', rowIndex) != '') {
    infoSolicitud = {
      docId: readCell('A', rowIndex),
      applicationId: readCell('B', rowIndex),
      randomNumber: Number(readCell('C', rowIndex).replace(',','.')),
      personalId: readCell('D', rowIndex),
      especialNeeds: ['si','sí'].includes(readCell('E', rowIndex).toLowerCase()),
      listaCentrosCiclosModulos: Array()
    };  
    validateAndAppendCourse('F', infoSolicitud, true);
    validateAndAppendCourse('G', infoSolicitud);
    validateAndAppendCourse('H', infoSolicitud);
    validateAndAppendCourse('I', infoSolicitud);
    infoSolicitud.scoring = Number(readCell('M', rowIndex).replace(',','.'));
    infoSolicitud.handicapped = ['si','sí'].includes(readCell('N', rowIndex).toLowerCase());
    infoSolicitud.eliteAthlete =  ['si','sí'].includes(readCell('O', rowIndex).toLowerCase());
    infoSolicitud.incumple =  readCell('P', rowIndex).toLowerCase();
    if (String(infoSolicitud.incumple || '') == '') {
      listaSolicitudesAceptadas.push(infoSolicitud);
    }
    else{
      listaSolicitudesNoAceptadas.push(infoSolicitud);
    }
    rowIndex++;
  }

  console.log(`listaCentrosCiclosModulos.length:${listaCentrosCiclosModulos.length}`);
  console.log(`listaSolicitudesAceptadas.length:${listaSolicitudesAceptadas.length}`);
  console.log(`listaSolicitudesNoAceptadas.length:${listaSolicitudesNoAceptadas.length}`);

  // Tratar asignaciones por prioridades
  var listaAsignadosDiscapacitados = Array();
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    var listaSolicitudesAceptadasCopia = JSON.parse(JSON.stringify(listaSolicitudesAceptadas));
    var lista = Array();
    cursoCentroCicloModulo.listaAsignadosDiscapacitados = Array();
    cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera = Array();
    cursoCentroCicloModulo.listaAsignadosDeportistasElite = Array();
    cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera = Array();
    cursoCentroCicloModulo.listaAsignados = Array();
    cursoCentroCicloModulo.listaAsignadosEspera = Array();
    const claveCurso = (cursoCentroCicloModulo.codigoCentro || '') + "_" + (cursoCentroCicloModulo.codigoCurso || '') + "_" + (cursoCentroCicloModulo.codigoModulo || '');

    var vacantesDisponibles = cursoCentroCicloModulo.vacantes;

    const vacantesDiscapacitados = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageHandicap * config.numSlotsBySeatHandicap);
    if (vacantesDiscapacitados>0){
      // Obtener la lista de discapacitados que correspondan al centro-ciclo-modulo
      listaAsignadosDiscapacitados = listaSolicitudesAceptadasCopia.filter(sol => ((sol.handicapped) 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)))
        .sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDiscapacitados = listaAsignadosDiscapacitados.slice(0,vacantesDiscapacitados);
      //cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera = listaAsignadosDiscapacitados.slice(vacantesDiscapacitados);
      lista = lista.concat(cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(sol=>sol.applicationId));
      vacantesDisponibles -= cursoCentroCicloModulo.listaAsignadosDiscapacitados.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
    }
    const vacantesDeportistasElite = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageAthlete * config.numSlotsBySeatAthlete);
    if ((vacantesDeportistasElite>0) && (vacantesDisponibles>0)){
      // Obtener la lista de deportista de élite que correspondan al centro-ciclo-modulo
      listaAsignadosDeportistasElite = listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (sol.eliteAthlete) 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)))
        .sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = listaAsignadosDeportistasElite.slice(0,vacantesDeportistasElite);
      //cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera = listaAsignadosDeportistasElite.slice(vacantesDeportistasElite);
      lista = lista.concat(cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(sol=>sol.applicationId));
      vacantesDisponibles -= cursoCentroCicloModulo.listaAsignadosDeportistasElite.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
    }
    // Resto solicitantes
    if (vacantesDisponibles>0){
      // Obtener la lista de solicitantes que correspondan al centro-ciclo-modulo y no están en los grupos anteriores
      listaAsignados = listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId))
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)))
        .sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignados = listaAsignados.slice(0,vacantesDisponibles);
      cursoCentroCicloModulo.listaAsignadosEspera = listaAsignados.slice(vacantesDisponibles);
      lista = lista.concat(cursoCentroCicloModulo.listaAsignados.map(sol=>sol.applicationId));
      vacantesDisponibles -= cursoCentroCicloModulo.listaAsignados.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
      if (vacantesDisponibles<0) {
        const vac = vacantesDisponibles*-1
        for (var j =0; j<vac; j++) {
          cursoCentroCicloModulo.listaAsignadosEspera.unshift(cursoCentroCicloModulo.listaAsignados.pop());
          vacantesDisponibles++;
        }
      }
    }
    cursoCentroCicloModulo.vacantesDisponibles = vacantesDisponibles;
    console.log(`cursoCentroCicloModulo.vacantesDisponibles:${cursoCentroCicloModulo.vacantesDisponibles}`);
  }

  const filename = `${category}_${Date.now()}_`;
  const contentHeaderFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'headerBase.html'));
  const admitidosBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `admitidosBase${category}.html`));
  const esperaBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `esperaBase${category}.html`));
  const excluidosBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `excluidosBase${category}.html`));

  var contentAdmitidosExcel = 'ORDEN;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CICLO;DNI;IDENTIFICACION;PUNTUACION;' +
  'NEE;MINUSVALÍA;ATLETA;\r\n';
  var contentEsperaExcel = 'ORDEN;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CICLO;DNI;IDENTIFICACION;PUNTUACION;' +
  'NEE;MINUSVALÍA;ATLETA;\r\n';
  var contentExcluidosExcel = 'NUMERO;NOMBRE;MOTIVO EXCLUSION;\r\n';

  if (contentHeaderFile && admitidosBaseHtml && esperaBaseHtml){

    let htmlListaAdmitidos = contentHeaderFile.toString();
    let htmlListaEspera = contentHeaderFile.toString();
    let htmlListaExcluidos = contentHeaderFile.toString();
    const numLinesPerPage = 50;
    for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
      
    // Generar lista admitidos

      // Asignados discapacitados
      var orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDiscapacitados.length>0) {
        cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(ap => {
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textGBTypeGeneral##', config.textGBTypeHandicap)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            + `${(ap.scoring || '')};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += '</table>';
            htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaAdmitidos += `</table>`;
        htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
      }

      // Asignados deportistas de élite
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDeportistasElite.length>0) {
        cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(ap => {
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textGBTypeGeneral##', config.textGBTypeAthlete)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            + `${(ap.scoring || '')};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += '</table>';
            htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaAdmitidos += `</table>`;
        htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
      }

      // Asignados resto
      orden=0;
      if (cursoCentroCicloModulo.listaAsignados.length>0) {
        cursoCentroCicloModulo.listaAsignados.map(ap => {
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textGBTypeGeneral##', config.textGBTypeGeneral)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            + `${(ap.scoring || '')};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += '</table>';
            htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaAdmitidos += `</table>`;
        htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
      }

      // Generar lista espera discapacitados
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera.map(ap => {
          if (orden%numLinesPerPage==0){
            htmlListaEspera += esperaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textGBTypeGeneral##', config.textGBTypeHandicap)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            + `${(ap.scoring || '')};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaEspera += '</table>';
            htmlListaEspera += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaEspera += `</table>`;
        htmlListaEspera += `<div style="page-break-after:always"></div>`;
      }
      // Generar lista espera deportista élite
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera.map(ap => {
          if (orden%numLinesPerPage==0){
            htmlListaEspera += esperaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textGBTypeGeneral##', config.textGBTypeAthlete)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            + `${(ap.scoring || '')};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaEspera += '</table>';
            htmlListaEspera += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaEspera += `</table>`;
        htmlListaEspera += `<div style="page-break-after:always"></div>`;
      }
      // Generar lista espera resto
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosEspera.map(ap => {
          if (orden%numLinesPerPage==0){
            htmlListaEspera += esperaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textGBTypeGeneral##', config.textGBTypeGeneral)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            + `${(ap.scoring || '')};${ap.especialNeeds ? 'SI' : 'NO'};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaEspera += '</table>';
            htmlListaEspera += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaEspera += `</table>`;
        htmlListaEspera += `<div style="page-break-after:always"></div>`;
      }

    }// for

    htmlListaAdmitidos += `</body>`;
    htmlListaAdmitidos += `</html>`;
    htmlListaEspera += `</body>`;
    htmlListaEspera += `</html>`;
    
    // Generar lista exclusión
    orden=0;
    var contentExcluidosExcel = 'NUMERO;DNI;NOMBRE;CODIGO EXCLUSION;MOTIVO EXCLUSION;\r\n';
    listaSolicitudesNoAceptadas.sort(function(a,b){return (String(a.personalId.substr(a.personalId.indexOf(', ') + 2)).localeCompare(String(b.personalId.substr(b.personalId.indexOf(', ') + 2))))}).map(ap => {
      if (orden%numLinesPerPage==0){
        htmlListaExcluidos += excluidosBaseHtml.toString()
        .replace('##titleGeneral##', config.titleGeneral)
        .replace('##textGBTitleGeneral##', config.textGBTitleGeneral)
        .replace('##city##', city)
        .replace('##titleCurse##', config.titleCurse)
        .replace('##titleRejected##', config.titleRejected)
        .replace('##textGBTypeGeneral##', config.textGBTypeGeneral)
        .replace('##titleWarning##', config.titleWarning)
      }  

      htmlListaExcluidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
      htmlListaExcluidos += `	  <td>${orden}</td>`;
      htmlListaExcluidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${generarTextoExclusionGB(ap.incumple)}</td>`;
      htmlListaExcluidos += `  </tr>`;
      contentExcluidosExcel+= `${(orden || '')};${ap.docId ? `${ap.docId}` : 'Ninguno'};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};${ap.incumple};${generarTextoExclusionGB(ap.incumple)}\r\n`;
      if (orden%numLinesPerPage==0){
        htmlListaExcluidos += '</table>';
        htmlListaExcluidos += `<div style="page-break-after:always"></div>`;
      }
    });
    htmlListaExcluidos += `</table>`;
    htmlListaExcluidos += `<div style="page-break-after:always"></div>`;
    htmlListaExcluidos += `</body>`;
    htmlListaExcluidos += `</html>`;
    
    
    const contentAdmitidosPdf = await html_to_pdf.generatePdf({ content: htmlListaAdmitidos }, 
    { 
        format: 'A4',
        displayHeaderFooter: true,
        footerTemplate: '<style>span{width:100% !important;text-align:center !important;font-size:8px !important;font-family: "Calibri"; }</style><span>Página <label class="pageNumber"></label> de <label class="totalPages"> </label> </span>',
        margin: { top: "0px", bottom: "50px", right: "0px", left: "0px" }
    });
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Admitidos.pdf"), contentAdmitidosPdf);
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Admitidos.csv"), contentAdmitidosExcel, 'latin1');

    const contentEsperaPdf = await html_to_pdf.generatePdf({ content: htmlListaEspera }, 
      { 
          format: 'A4',
          displayHeaderFooter: true,
          footerTemplate: '<style>span{width:100% !important;text-align:center !important;font-size:8px !important;font-family: "Calibri"; }</style><span>Página <label class="pageNumber"></label> de <label class="totalPages"> </label> </span>',
          margin: { top: "0px", bottom: "50px", right: "0px", left: "0px" }
      });
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Espera.pdf"), contentEsperaPdf);
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Espera.csv"), contentEsperaExcel, 'latin1');
    
    const contentExcluidosPdf = await html_to_pdf.generatePdf({ content: htmlListaExcluidos }, 
      { 
          format: 'A4',
          displayHeaderFooter: true,
          footerTemplate: '<style>span{width:100% !important;text-align:center !important;font-size:8px !important;font-family: "Calibri"; }</style><span>Página <label class="pageNumber"></label> de <label class="totalPages"> </label> </span>',
          margin: { top: "0px", bottom: "50px", right: "0px", left: "0px" }
      });
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Excluidos.pdf"), contentExcluidosPdf);
    fs.writeFileSync(path.join(__dirname, '..', 'temp', filename+"Excluidos.csv"), contentExcluidosExcel, 'latin1');
    
  }

  return `${filename}`;
}

module.exports = { processAssigns };
