const xlsx = require('xlsx');
const path = require('path');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');
const toNumber = (valor) => {
  if (isNaN(valor)){
    return Number(valor.replace('.','').replace(',','.'))
  }
  return Number (valor)
}
const toNumberRandom = (valor) => {
  if (isNaN(valor)){
    return Number(valor.replace(',',''))
  }
  return Number (valor)
}

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
  const DESCARTADO = 'DESCARTADO-MEJORA';
  const writeCell = (column, row, cellValue) => {
    if (wb.Sheets[dataSheet][`${column}${row}`]?.v){
      wb.Sheets[dataSheet][`${column}${row}`].v = cellValue;
      wb.Sheets[dataSheet][`${column}${row}`].w = cellValue;
    }
    else {
      xlsx.utils.sheet_add_aoa(wb.Sheets[dataSheet], [[cellValue]], {origin: `${column}${row}`});
    }
  }
  const generarTextoExclusionGB = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo+=config.textGBR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo+=config.textGBR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo+=config.textGBR3 + ' / ';
    return motivo.slice(0,-2)
  }

  let rowIndex = 3;
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
      (c.numeroCurso>0)?
        ((curso.match(new RegExp(c.codigoCurso.slice(0, -1), 'i')) != null) && (curso.match(new RegExp(`\# ${c.numeroCurso} curso`, 'i')) != null) && (curso.match(new RegExp(c.codigoCentro, 'i')) != null))
      : ((curso.match(new RegExp(c.codigoCurso.slice(0, -1), 'i')) != null) && (curso.match(new RegExp(c.codigoCentro, 'i')) != null))
    ); // NOTE: Buscamos que contenga el código del curso, el centro y el numero de curso si existe
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
        curso: selectedCourse.curso,
        prioridad: false,
      }
      if (Number(selectedCourse.vacantes>0)){
        infoSolicitud.listaCentrosCiclosModulos.push(centrosCiclosModulo);
      }
      else{
        console.log(`Eliminada peticion ${infoSolicitud.applicationId} porque el curso ${selectedCourse.curso} no tiene plazas.`);
        infoSolicitud.eliminadaPeticion = true;
      }
    }
  }

  // Leer del excel los datos de las listaSolicitudesAceptadas
  while (readCell('A', rowIndex) != '') {
    if (DESCARTADO!=readCell('A', rowIndex)){    
      infoSolicitud = {
        docId: readCell('A', rowIndex),
        applicationId: readCell('B', rowIndex),
        randomNumber: toNumberRandom(readCell('C', rowIndex)),
        personalId: readCell('D', rowIndex),
        especialNeeds: ['si','sí'].includes(readCell('E', rowIndex).toLowerCase()),
        listaCentrosCiclosModulos: Array()
      };  
      validateAndAppendCourse('F', infoSolicitud);
      validateAndAppendCourse('G', infoSolicitud);
      validateAndAppendCourse('H', infoSolicitud);
      validateAndAppendCourse('I', infoSolicitud);
      infoSolicitud.viaAcceso = 'A';
      infoSolicitud.scoring = toNumber(readCell('M', rowIndex));
      infoSolicitud.handicapped = ['si','sí'].includes(readCell('N', rowIndex).toLowerCase());
      infoSolicitud.eliteAthlete =  ['si','sí'].includes(readCell('O', rowIndex).toLowerCase());
      infoSolicitud.incumple =  readCell('P', rowIndex).toLowerCase();
      if (String(infoSolicitud.incumple || '') == '') {
        listaSolicitudesAceptadas.push(infoSolicitud);
      }
      else{
          listaSolicitudesNoAceptadas.push(infoSolicitud);
      }
    }
    rowIndex++;
  }

  console.log(`listaCentrosCiclosModulos.length:${listaCentrosCiclosModulos.length}`);
  console.log(`listaSolicitudesAceptadas.length:${listaSolicitudesAceptadas.length}`);
  console.log(`listaSolicitudesNoAceptadas.length:${listaSolicitudesNoAceptadas.length}`);

  config.percentageA=Number(1);
  config.percentageB=Number(0);
  config.percentageC=Number(0);

  const redondear = (valor) => { 
    const result = Math.round(Number(valor));
    if (result) return result;

    return Number(1);
  }

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////




  // Paso 1 mapear los datos del excel en estructura lineal por solicitudes
  
  const generarClave = (registro) => {
    return `${(registro.codigoCentro||'')}_${(registro.codigoCurso||'')}_${(registro.codigoModulo||'')}`
  }
  const contarLista = (lista) => {
    var contador = Number(0);
    if ((!lista) || (!Array.isArray(lista))) return contador;

    for (var i=0; i<lista.length; i++){
      contador += lista[i].especialNeeds?Number(2):Number(1);
    }
    return contador;
  }
  const mapearLinealmenteDatosIniciales = (registro, index) => { 
    if ((!registro) || (!registro.applicationId) || (![0,1,2,3].includes(index)) || (!registro.listaCentrosCiclosModulos[index])) return null;
    return {
      applicationId: registro.applicationId,
      asignado: false,
      espera: true,
      prioridadPeticion: index,
      preferencia: registro.listaCentrosCiclosModulos[index].prioridad? registro.listaCentrosCiclosModulos[index].prioridad : false,
      //scoring : registro.scoring? Number(registro.scoring) : Number(0),
      scoring : registro.scoring? (registro.listaCentrosCiclosModulos[index].prioridad?Number(registro.scoring) + Number(4) : Number(registro.scoring)) : Number(0),
      viaAcceso: registro.viaAcceso? registro.viaAcceso.toLocaleUpperCase() : '',
      eliteAthlete: registro.eliteAthlete? registro.eliteAthlete : false,
      handicapped: registro.handicapped? registro.handicapped : false,
      especialNeeds: registro.especialNeeds? registro.especialNeeds : false,
      randomNumber: Number(registro.randomNumber),
      docId: registro.docId,
      personalId: registro.personalId,
      claveCentroCicloModulo: generarClave(registro.listaCentrosCiclosModulos[index]),
      centro: registro.listaCentrosCiclosModulos[index].centro || '',
      codigoCentro: registro.listaCentrosCiclosModulos[index].codigoCentro || '',
      curso: registro.listaCentrosCiclosModulos[index].curso || '',
      codigoCurso: registro.listaCentrosCiclosModulos[index].codigoCurso || '',
      modulo: registro.listaCentrosCiclosModulos[index].modulo || '',
      codigoModulo: registro.listaCentrosCiclosModulos[index].codigoModulo || ''
    }
  }

  /*const ordenarCandidatos = (c1, c2) => {
    if ((typeof c1.preferencia === 'undefined') || (typeof c2.preferencia === 'undefined')){
      console.log("ERROR EN SORT preferencia");
    }
    if (Number(c1.preferencia) != Number(c2.preferencia)) {
      return Number(c2.preferencia) - Number(c1.preferencia);
    }
    else {
        if (Number(c1.scoring) != Number(c2.scoring)) {
        return Number(c2.scoring) - Number(c1.scoring);
      } else {
        // NOTE: Si hay empate en scoring, se escoge el que más cerca esté del randomNumber, en dirección siempre creciente-modular
        if (((Number(c1.randomNumber) - Number(config.randomNumberSelected)) >= 0 && (Number(c2.randomNumber) - Number(config.randomNumberSelected)) >= 0) ||
          (((Number(c1.randomNumber) - Number(config.randomNumberSelected)) < 0 && (Number(c2.randomNumber) - Number(config.randomNumberSelected)) < 0))) {
          return Number(c1.randomNumber) - Number(c2.randomNumber);
        } else {
          return Number(c2.randomNumber) - Number(c1.randomNumber);
        }
      }
    }
  }*/
  const ordenarCandidatos = (c1, c2) => {
    if (Number(c1.scoring) != Number(c2.scoring)) {
      return Number(c2.scoring) - Number(c1.scoring);
    } else {
      // NOTE: Si hay empate en scoring, se escoge el que más cerca esté del randomNumber, en dirección siempre creciente-modular
      if (((Number(c1.randomNumber) - Number(config.randomNumberSelected)) >= 0 && (Number(c2.randomNumber) - Number(config.randomNumberSelected)) >= 0) ||
        (((Number(c1.randomNumber) - Number(config.randomNumberSelected)) < 0 && (Number(c2.randomNumber) - Number(config.randomNumberSelected)) < 0))) {
        return Number(c1.randomNumber) - Number(c2.randomNumber);
      } else {
        return Number(c2.randomNumber) - Number(c1.randomNumber);
      }
    }
  }

  const listaSolicitudesAceptadasMapeadas = listaSolicitudesAceptadas.reduce(function(listaAcumulada, solicitud){
    for (var i=0; i<4; i++){
      const registro = mapearLinealmenteDatosIniciales(solicitud, i);
      if ((registro) && (registro!=null)){
        listaAcumulada.push(registro);
      }
    }
    return listaAcumulada;
  },Array()).sort(ordenarCandidatos)

  const rellenarCandidatos = (cursoCentroCicloModulo, prioridadPeticion, vacantesSolicitadas, listaCandidatosFiltradosOrdenados, tipoVacantesPendientes) => {
    var listaAsignados = Array()
    var vacantesAsignadas = Number(0);
    var vacantesAsignarTotales = vacantesSolicitadas + cursoCentroCicloModulo[tipoVacantesPendientes];

    if ((!cursoCentroCicloModulo) || (!listaCandidatosFiltradosOrdenados) || (vacantesAsignarTotales<=0)) return listaAsignados;

    while ((cursoCentroCicloModulo.vacantesDisponibles>0) && (vacantesAsignadas<vacantesAsignarTotales)) {
      // Obtener siguiente candidato
      const candidatoSelecionado = listaCandidatosFiltradosOrdenados.find(lc=>!lc.asignado);
      if (candidatoSelecionado) {
        // Anotar candidato
        listaAsignados.push(candidatoSelecionado);
        cursoCentroCicloModulo.vacantesDisponibles -= candidatoSelecionado.especialNeeds?Number(2):Number(1);
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>prioridadPeticion)).map(l=>l.asignado=false);
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion==prioridadPeticion)).map(l=>l.asignado=true);
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>=prioridadPeticion)).map(l=>l.espera=false);
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion<prioridadPeticion)).map(l=>l.espera=true);
        vacantesAsignadas++;
      }
      else {
        cursoCentroCicloModulo[tipoVacantesPendientes] = vacantesAsignarTotales-vacantesAsignadas;
        return listaAsignados;
      }
    }
    cursoCentroCicloModulo[tipoVacantesPendientes] = vacantesAsignarTotales-vacantesAsignadas;
    return listaAsignados;
  }

  const mejorarPosicionesCandidatos = (cursoCentroCicloModulo, listaAsignados, listaCandidatos) => {

    if (!Array.isArray(listaAsignados) || !Array.isArray(listaCandidatos) || listaAsignados.length==0 || listaCandidatos.length==0) return listaAsignados;

    const longitudLista=listaAsignados.length;

    var copia = Array().concat(listaAsignados);
    listaCandidatos.forEach(lc=>{
      if (!copia.map(lsam=>lsam.applicationId).includes(lc.applicationId)){
        copia.push(lc);
      }
    });
    // IMPORTANTE QUITAR DUPLICADOS
    copia.map(lsam=>lsam.applicationId).filter((value, index, self) =>self.indexOf(value) === index).forEach(applicationId=>{
      if (copia.filter(lsam=>(lsam.asignado && lsam.applicationId==applicationId)).length>1) {
        console.log(`ERROR. Repetidos en mejorarPosicionesCandidatos, applicationId: ${applicationId}`)
      }
    });
    // IMPORTANTE ORDENARLA!
    copia = copia.sort(ordenarCandidatos);

    listaAsignados.forEach(la=>{
      cursoCentroCicloModulo.vacantesDisponibles += la.especialNeeds?Number(2):Number(1);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==la.applicationId)).map(l=>l.espera=true);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==la.applicationId)).map(l=>l.asignado=false);
    });

    listaAsignados = Array();
    for (var i=0; ((i<longitudLista) && (cursoCentroCicloModulo.vacantesDisponibles>0)); i++){
      const candidatoSelecionado = copia[i];
      // Anotar candidato
      listaAsignados.push(candidatoSelecionado);
      cursoCentroCicloModulo.vacantesDisponibles -= candidatoSelecionado.especialNeeds?Number(2):Number(1);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=false);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion==candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=true);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>=candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=false);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion<candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=true);
    }
    return listaAsignados;
  }
  

  // Generamos las lista de solicitantes por los 5 grupos (minusvalidos, deportistas, A, B y C)
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    cursoCentroCicloModulo.claveCentroCicloModulo = generarClave(cursoCentroCicloModulo);
    cursoCentroCicloModulo.vacantesPendientesDiscapacitados = Number(0);
    cursoCentroCicloModulo.vacantesPendientesDeportistasElite = Number(0);
    cursoCentroCicloModulo.vacantesPendientesA = Number(0);
    cursoCentroCicloModulo.vacantesPendientesB = Number(0);
    cursoCentroCicloModulo.vacantesPendientesC = Number(0);
    cursoCentroCicloModulo.listaAsignadosDiscapacitados = Array();
    cursoCentroCicloModulo.listaAsignadosDeportistasElite = Array();
    cursoCentroCicloModulo.listaAsignadosA = Array();
    cursoCentroCicloModulo.listaAsignadosB = Array();
    cursoCentroCicloModulo.listaAsignadosC = Array();
    cursoCentroCicloModulo.listaAsignadosAEspera = Array();
    cursoCentroCicloModulo.listaAsignadosBEspera = Array();
    cursoCentroCicloModulo.listaAsignadosCEspera = Array();
    cursoCentroCicloModulo.vacantesDisponibles = cursoCentroCicloModulo.vacantes;
  }

  for (var opcionSolicitud=0; opcionSolicitud<4; opcionSolicitud++) {
    for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {

      cursoCentroCicloModulo.vacantesPendientesDiscapacitados = 0;
      cursoCentroCicloModulo.vacantesPendientesDeportistasElite = 0;
      const listaSolicitantesDiscapacitados = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera && opcionSolicitud>=lsam.prioridadPeticion && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.handicapped)).sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosDiscapacitados = mejorarPosicionesCandidatos(cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosDiscapacitados, listaSolicitantesDiscapacitados);
      const listaSolicitantesDeportistasElite = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera && opcionSolicitud>=lsam.prioridadPeticion && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.eliteAthlete)).sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = mejorarPosicionesCandidatos(cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosDeportistasElite, listaSolicitantesDeportistasElite);

      // Asignamos % fijo de vacantes a minusválidos
      const vacantesMinusvalidos = redondear(cursoCentroCicloModulo.vacantes * config.percentageHandicap);
      if (vacantesMinusvalidos>contarLista(cursoCentroCicloModulo.listaAsignadosDiscapacitados)) {
        cursoCentroCicloModulo.listaAsignadosDiscapacitados = cursoCentroCicloModulo.listaAsignadosDiscapacitados.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, vacantesMinusvalidos, listaSolicitantesDiscapacitados, 'vacantesPendientesDiscapacitados')).sort(ordenarCandidatos);
      }
      // Asignamos % fijo de vacantes a deportistas de élite
      const vacantesDeportistas = redondear(cursoCentroCicloModulo. vacantes * config.percentageAthlete);
      if (vacantesDeportistas>contarLista(cursoCentroCicloModulo.listaAsignadosDeportistasElite)) {
        cursoCentroCicloModulo.listaAsignadosDeportistasElite = cursoCentroCicloModulo.listaAsignadosDeportistasElite.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, vacantesDeportistas, listaSolicitantesDeportistasElite, 'vacantesPendientesDeportistasElite')).sort(ordenarCandidatos);
      }
    }
  }
  const MaxVueltas = 5;
  for (var vueltas=0; vueltas<MaxVueltas; vueltas++) {
  
    for (var opcionSolicitud=0; opcionSolicitud<4; opcionSolicitud++) {
      for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
        const listaSolicitantesA = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera && opcionSolicitud>=lsam.prioridadPeticion && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo 
          && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
            && lsam.viaAcceso=='A')).sort(ordenarCandidatos);
        cursoCentroCicloModulo.listaAsignadosA = mejorarPosicionesCandidatos(cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosA, listaSolicitantesA);

        const listaSolicitantesB = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera && opcionSolicitud>=lsam.prioridadPeticion && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo 
          && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
            && lsam.viaAcceso=='B')).sort(ordenarCandidatos);
        cursoCentroCicloModulo.listaAsignadosB = mejorarPosicionesCandidatos(cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosB, listaSolicitantesB);
          
        const listaSolicitantesC = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera && opcionSolicitud>=lsam.prioridadPeticion && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo 
          && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
            && lsam.viaAcceso=='C')).sort(ordenarCandidatos);
        cursoCentroCicloModulo.listaAsignadosC = mejorarPosicionesCandidatos(cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosC, listaSolicitantesC);

        // Asignamos al Grupo A (los que podamos dentro del rango del %)
        cursoCentroCicloModulo.listaAsignadosA = cursoCentroCicloModulo.listaAsignadosA.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, redondear((cursoCentroCicloModulo.vacantes-contarLista(cursoCentroCicloModulo.listaAsignadosDiscapacitados)-contarLista(cursoCentroCicloModulo.listaAsignadosDeportistasElite)) * config.percentageA), 
            listaSolicitantesA, 'vacantesPendientesA')).sort(ordenarCandidatos);

        // Asignamos al Grupo B (los que podamos dentro del rango del %)
        cursoCentroCicloModulo.listaAsignadosB = cursoCentroCicloModulo.listaAsignadosB.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, redondear((cursoCentroCicloModulo.vacantes-contarLista(cursoCentroCicloModulo.listaAsignadosDiscapacitados)-contarLista(cursoCentroCicloModulo.listaAsignadosDeportistasElite)) * config.percentageB), 
            listaSolicitantesB, 'vacantesPendientesB')).sort(ordenarCandidatos);

        // Asignamos al Grupo C (los que podamos dentro del rango del %)
        cursoCentroCicloModulo.listaAsignadosC = cursoCentroCicloModulo.listaAsignadosC.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, redondear((cursoCentroCicloModulo.vacantes-contarLista(cursoCentroCicloModulo.listaAsignadosDiscapacitados)-contarLista(cursoCentroCicloModulo.listaAsignadosDeportistasElite)) * config.percentageC), 
            listaSolicitantesC, 'vacantesPendientesC')).sort(ordenarCandidatos);

      }
    }
  
    for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
      
      cursoCentroCicloModulo.listaAsignadosA = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado && !lsam.espera 
        && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
          && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='A')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.listaAsignadosA.length);
      cursoCentroCicloModulo.listaAsignadosB = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado && !lsam.espera 
        && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
          && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='B')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.listaAsignadosB.length);
      cursoCentroCicloModulo.listaAsignadosC = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado && !lsam.espera 
        && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
          && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='C')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.listaAsignadosC.length);

      cursoCentroCicloModulo.vacantesDisponibles = cursoCentroCicloModulo.vacantes - (contarLista(cursoCentroCicloModulo.listaAsignadosDiscapacitados) + contarLista(cursoCentroCicloModulo.listaAsignadosDeportistasElite) + contarLista(cursoCentroCicloModulo.listaAsignadosA) + contarLista(cursoCentroCicloModulo.listaAsignadosB) + contarLista(cursoCentroCicloModulo.listaAsignadosC));
    } 


    // Asignamos los ultimos que se quedan fuera para completar las plazas.
    for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {

      if (cursoCentroCicloModulo.vacantesDisponibles>0) {
        const existenCandidatosA = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera 
          && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
            && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='A')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.vacantesDisponibles);
        existenCandidatosA.forEach(candidatoSelecionado=>{
          cursoCentroCicloModulo.listaAsignadosA.push(candidatoSelecionado)
          cursoCentroCicloModulo.vacantesDisponibles -= candidatoSelecionado.especialNeeds?Number(2):Number(1);
          candidatoSelecionado.asignado = true;
          candidatoSelecionado.espera = false;
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion==candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=true);
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>=candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=false);
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion<candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=true);
          if (listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>candidatoSelecionado.prioridadPeticion)).length>0) {
            console.log(`----------------- ${cursoCentroCicloModulo.centro || ''} ${cursoCentroCicloModulo.curso || ''} ${cursoCentroCicloModulo.modulo || ''} -----------------`);
            console.log(`MEJORA candidatoSelecionado: ${candidatoSelecionado.applicationId} ${candidatoSelecionado.viaAcceso} ${candidatoSelecionado.prioridadPeticion} ${candidatoSelecionado.scoring} ${candidatoSelecionado.eliteAthlete} ${candidatoSelecionado.handicapped} ${candidatoSelecionado.especialNeeds} ${candidatoSelecionado.randomNumber}`);
            listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=false);
          }
        });
        const existenCandidatosB = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera 
          && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
            && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='B')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.vacantesDisponibles);
            existenCandidatosB.forEach(candidatoSelecionado=>{
          cursoCentroCicloModulo.listaAsignadosB.push(candidatoSelecionado)
          cursoCentroCicloModulo.vacantesDisponibles -= candidatoSelecionado.especialNeeds?Number(2):Number(1);
          candidatoSelecionado.asignado = true;
          candidatoSelecionado.espera = false;
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion==candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=true);
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>=candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=false);
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion<candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=true);
          if (listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>candidatoSelecionado.prioridadPeticion)).length>0) {
            console.log(`----------------- ${cursoCentroCicloModulo.centro || ''} ${cursoCentroCicloModulo.curso || ''} ${cursoCentroCicloModulo.modulo || ''} -----------------`);
            console.log(`MEJORA candidatoSelecionado: ${candidatoSelecionado.applicationId} ${candidatoSelecionado.viaAcceso} ${candidatoSelecionado.prioridadPeticion} ${candidatoSelecionado.scoring} ${candidatoSelecionado.eliteAthlete} ${candidatoSelecionado.handicapped} ${candidatoSelecionado.especialNeeds} ${candidatoSelecionado.randomNumber}`);
            listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=false);
          }
        });
        const existenCandidatosC = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera 
          && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
            && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='C')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.vacantesDisponibles);
        existenCandidatosC.forEach(candidatoSelecionado=>{
          cursoCentroCicloModulo.listaAsignadosC.push(candidatoSelecionado)
          cursoCentroCicloModulo.vacantesDisponibles -= candidatoSelecionado.especialNeeds?Number(2):Number(1);
          candidatoSelecionado.asignado = true;
          candidatoSelecionado.espera = false;
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion==candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=true);
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>=candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=false);
          listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion<candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=true);
          if (listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>candidatoSelecionado.prioridadPeticion)).length>0) {
            console.log(`----------------- ${cursoCentroCicloModulo.centro || ''} ${cursoCentroCicloModulo.curso || ''} ${cursoCentroCicloModulo.modulo || ''} -----------------`);
            console.log(`MEJORA candidatoSelecionado: ${candidatoSelecionado.applicationId} ${candidatoSelecionado.viaAcceso} ${candidatoSelecionado.prioridadPeticion} ${candidatoSelecionado.scoring} ${candidatoSelecionado.eliteAthlete} ${candidatoSelecionado.handicapped} ${candidatoSelecionado.especialNeeds} ${candidatoSelecionado.randomNumber}`);
            listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.prioridadPeticion>candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=false);
          }
        });
        
      }
      
      cursoCentroCicloModulo.listaAsignadosA = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado && !lsam.espera 
        && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
          && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='A')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.listaAsignadosA.length);
      cursoCentroCicloModulo.listaAsignadosB = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado && !lsam.espera 
        && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
          && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='B')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.listaAsignadosB.length);
      cursoCentroCicloModulo.listaAsignadosC = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado && !lsam.espera 
        && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
          && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='C')).sort(ordenarCandidatos).slice(0, cursoCentroCicloModulo.listaAsignadosC.length);

      cursoCentroCicloModulo.vacantesDisponibles = cursoCentroCicloModulo.vacantes - (contarLista(cursoCentroCicloModulo.listaAsignadosDiscapacitados) + contarLista(cursoCentroCicloModulo.listaAsignadosDeportistasElite) + contarLista(cursoCentroCicloModulo.listaAsignadosA) + contarLista(cursoCentroCicloModulo.listaAsignadosB) + contarLista(cursoCentroCicloModulo.listaAsignadosC));
      
      if (cursoCentroCicloModulo.vacantesDisponibles>0) {
        console.log(`----------------- ${cursoCentroCicloModulo.centro || ''} ${cursoCentroCicloModulo.curso || ''} ${cursoCentroCicloModulo.modulo || ''} -----------------`);
        console.log(`Discapacitados ${cursoCentroCicloModulo.listaAsignadosDiscapacitados.length}`);
        console.log(`Deportitas     ${cursoCentroCicloModulo.listaAsignadosDeportistasElite.length}`);
        console.log(`Grupo A        ${cursoCentroCicloModulo.listaAsignadosA.length}`);
        console.log(`Grupo B        ${cursoCentroCicloModulo.listaAsignadosB.length}`);
        console.log(`Grupo C        ${cursoCentroCicloModulo.listaAsignadosC.length}`);
        console.log(`Total          ${cursoCentroCicloModulo.listaAsignadosDiscapacitados.length + cursoCentroCicloModulo.listaAsignadosDeportistasElite.length + cursoCentroCicloModulo.listaAsignadosA.length + cursoCentroCicloModulo.listaAsignadosB.length + cursoCentroCicloModulo.listaAsignadosC.length}`)
        console.log(`Vacantes disponibles ${cursoCentroCicloModulo.vacantesDisponibles} de ${cursoCentroCicloModulo.vacantes}`);
      }

    }
  }


  // Verificar repetidos
  var NumRepetidos = 0;
  listaSolicitudesAceptadasMapeadas.map(lsam=>lsam.applicationId).filter((value, index, self) =>self.indexOf(value) === index).forEach(applicationId=>{
    if (listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado && lsam.applicationId==applicationId)).length>1) {
      console.log(`ERROR. Repetidos ${applicationId}`)
      NumRepetidos++;
    }
  });
  console.log(`TOTAL REPETIDOS: ${NumRepetidos}`)
  
  listaSolicitudesAceptadasMapeadas.forEach(candidatoSelecionado=>{

    if (candidatoSelecionado.asignado && candidatoSelecionado.espera) {
      console.log(`ERROR DE COHERENCIA EN ${candidatoSelecionado.applicationId} `)
      candidatoSelecionado.asignado = false;
    }

  });

  // Rellenar las listas de espera
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    cursoCentroCicloModulo.listaAsignadosAEspera = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera 
      && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
        && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='A')).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosBEspera = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera 
      && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
        && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='B')).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosCEspera = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera 
      && !cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(l=>l.applicationId).includes(lsam.applicationId) && !cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(l=>l.applicationId).includes(lsam.applicationId)
        && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.viaAcceso=='C')).sort(ordenarCandidatos);

    if ((cursoCentroCicloModulo.listaAsignadosAEspera.length>0) || (cursoCentroCicloModulo.listaAsignadosBEspera.length>0) || (cursoCentroCicloModulo.listaAsignadosCEspera.length>0)){
      console.log(`----------------- ${cursoCentroCicloModulo.centro || ''} ${cursoCentroCicloModulo.curso || ''} ${cursoCentroCicloModulo.modulo || ''} (${cursoCentroCicloModulo.claveCentroCicloModulo})-----------------`);
      console.log(`En espera un total de  ${cursoCentroCicloModulo.listaAsignadosAEspera.length+cursoCentroCicloModulo.listaAsignadosBEspera.length+cursoCentroCicloModulo.listaAsignadosCEspera.length}`);

    }
  }  


  var listaAsignadosGeneralesPorApplicationId = Array();
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    listaAsignadosGeneralesPorApplicationId = listaAsignadosGeneralesPorApplicationId.concat(
      cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(list=>list.applicationId),
        cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(list=>list.applicationId),
          cursoCentroCicloModulo.listaAsignadosA.map(list=>list.applicationId),
            cursoCentroCicloModulo.listaAsignadosB.map(list=>list.applicationId),
              cursoCentroCicloModulo.listaAsignadosC.map(list=>list.applicationId))
  }

  if (listaAsignadosGeneralesPorApplicationId.length!=listaSolicitudesAceptadasMapeadas.filter(lsam=>lsam.asignado).length) {
    console.log(`ERROR DE COHERENCIA EN ASIGNADOS`)
    console.log(`TOTAL ASIGNADOS: ${listaAsignadosGeneralesPorApplicationId.length} FRENTE a TOTAL SOLICITUDES ASIGNADAS: ${listaSolicitudesAceptadasMapeadas.filter(lsam=>lsam.asignado).length}`)
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
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
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
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
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
      if (cursoCentroCicloModulo.listaAsignadosA.length>0) {
        cursoCentroCicloModulo.listaAsignadosA.map(ap => {
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
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
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

      // Generar lista espera resto
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosAEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosAEspera.map(ap => {
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
          htmlListaEspera += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
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

    
    //////////////////
    // PROCESAR MEJORA
    //////////////////
    rowIndex = 3;
    while (readCell('A', rowIndex) != '') {
      // Dejar a vacio las columnas de minusválidos y deportistas de élite
      writeCell('N', rowIndex, '');
      writeCell('O', rowIndex, '');
      // Incumple
      if ((readCell('P', rowIndex).toLowerCase() || '') != '') {
        // Borrar linea no desplazarla
        writeCell('A', rowIndex, DESCARTADO);
      }
      const applicationId = readCell('B', rowIndex);
      const candidato = listaSolicitudesAceptadasMapeadas.find(lsam=>(lsam.applicationId==applicationId && lsam.asignado));
      if (candidato){
        if (candidato.prioridadPeticion==0){ // NO existe mejora posible
          // Borrar linea no desplazarla
          writeCell('A', rowIndex, DESCARTADO);
        }
        else {
          if (candidato.prioridadPeticion<2){
            writeCell('G', rowIndex, '');
          }
          if (candidato.prioridadPeticion<3){
            writeCell('H', rowIndex, '');
          }
          writeCell('I', rowIndex, '');
        }
      }
      rowIndex++;
    }
    xlsx.writeFile(wb, path.join(__dirname, '..', 'temp', filename+"Mejora.xlsx"), { type: 'base64' } );
  }

  return `${filename}`;
}

module.exports = { processAssigns };
