const xlsx = require('xlsx');
const path = require('path');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

async function processAssigns(category, city, filePath, config) {
  const listaSolicitudesACEDtadas = Array();
  const listaSolicitudesNoACEDtadas = Array();
  const listaCentrosCiclosModulos = await courseService.getCategoryCourses(city, category);
  const wb = xlsx.readFile(filePath);
  const dataSheet = wb.SheetNames[0];
  const readCell = (column, row) => {
    const cellValue = wb.Sheets[dataSheet][`${column}${row}`];
    return cellValue ? cellValue.w || cellValue.v.toString() || '' : '';
  }
  const sortCandidates = (c1, c2) => {
    if ((typeof c1.preferencia === 'undefined') || (typeof c2.preferencia === 'undefined')){
      console.log("ERROR EN SORT");
    }
    if (Number(c1.preferencia) != Number(c2.preferencia)) {
      return Number(c2.preferencia) - Number(c1.preferencia);
    }
    else {
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
  }
  const sortCandidatesEspera = (clave) => {
    return function (c1, c2) {
      if ((typeof c1.preferencia[clave] === 'undefined') || (typeof c2.preferencia[clave] === 'undefined')){
        console.log("ERROR EN SORT");
      }
      if (Number(c1.preferencia[clave]) != Number(c2.preferencia[clave])) {
        return Number(c2.preferencia[clave]) - Number(c1.preferencia[clave]);
      }
      else {
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
    }
  }


  const generarTextoExclusionCED = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo+=config.textCEDR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo+=config.textCEDR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo+=config.textCEDR3 + ' / ';
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

  // Leer del excel los datos de las listaSolicitudesACEDtadas
  while (readCell('A', rowIndex) != '') {
    infoSolicitud = {
      docId: readCell('A', rowIndex),
      applicationId: readCell('B', rowIndex),
      randomNumber: Number(readCell('C', rowIndex).replace(',','')),
      personalId: readCell('D', rowIndex),
      especialNeeds: false,
      listaCentrosCiclosModulos: Array()
    };  
    validateAndAppendCourse('E', infoSolicitud);
    validateAndAppendCourse('F', infoSolicitud);
    validateAndAppendCourse('G', infoSolicitud);
    validateAndAppendCourse('H', infoSolicitud);
    infoSolicitud.scoring = Number(readCell('I', rowIndex).replace('.','').replace(',','.'));
    infoSolicitud.handicapped = ['si','sí'].includes(readCell('J', rowIndex).toLowerCase());
    infoSolicitud.eliteAthlete =  ['si','sí'].includes(readCell('K', rowIndex).toLowerCase());
    infoSolicitud.incumple =  readCell('L', rowIndex).toLowerCase();
    if (String(infoSolicitud.incumple || '') == '') {
      listaSolicitudesACEDtadas.push(infoSolicitud);
    }
    else{
      listaSolicitudesNoACEDtadas.push(infoSolicitud);
    }
    rowIndex++;
  }

  console.log(`listaCentrosCiclosModulos.length:${listaCentrosCiclosModulos.length}`);
  console.log(`listaSolicitudesAceptadas.length:${listaSolicitudesAceptadas.length}`);
  console.log(`listaSolicitudesNoAceptadas.length:${listaSolicitudesNoAceptadas.length}`);

  const redondear = (valor) => { 
    const result = Math.round(Number(valor));
    if (result) return result;

    return Number(1);
  }


  // Generar las listas de los admitidos por grupos. 5 grupos. Minusvalidos, Deportistas élite, Grupo A, Grupo B y Grupo C
  const mapearDatosIniciales = (registro, index) => { 
    if ((!registro) || (![0,1,2,3].includes(index)) || (!registro.listaCentrosCiclosModulos[index])) return null;
    return {
      applicationId: registro.applicationId,
      preferencia: registro.listaCentrosCiclosModulos[index].prioridad? registro.listaCentrosCiclosModulos[index].prioridad : false,
      scoring : registro.scoring? Number(registro.scoring) : Number(0),
      viaAcceso: registro.viaAcceso? registro.viaAcceso.toLocaleUpperCase() : 'A',
      eliteAthlete: registro.eliteAthlete? registro.eliteAthlete : false,
      handicapped: registro.handicapped? registro.handicapped : false,
      especialNeeds: registro.especialNeeds? registro.especialNeeds : false,
      randomNumber: Number(registro.randomNumber),
      docId: registro.docId,
      personalId: registro.personalId,
      centroCicloModulo: registro.listaCentrosCiclosModulos[index]
    }
  }
  var infoBaseAdmitidos = {

    minusvalido : {
      listaOrdenadaporPrioridadBaremoOpcion1: Array(),
      listaOrdenadaporPrioridadBaremoOpcion2: Array(),
      listaOrdenadaporPrioridadBaremoOpcion3: Array(),
      listaOrdenadaporPrioridadBaremoOpcion4: Array(),
      vacantesDisponibles: 0
    },
    deportista : {
      listaOrdenadaporPrioridadBaremoOpcion1: Array(),
      listaOrdenadaporPrioridadBaremoOpcion2: Array(),
      listaOrdenadaporPrioridadBaremoOpcion3: Array(),
      listaOrdenadaporPrioridadBaremoOpcion4: Array(),
      vacantesDisponibles: 0
    },
    grupoA : {
      listaOrdenadaporPrioridadBaremoOpcion1: Array(),
      listaOrdenadaporPrioridadBaremoOpcion2: Array(),
      listaOrdenadaporPrioridadBaremoOpcion3: Array(),
      listaOrdenadaporPrioridadBaremoOpcion4: Array(),
      vacantesDisponibles: 0
    },
    grupoB : {
      listaOrdenadaporPrioridadBaremoOpcion1: Array(),
      listaOrdenadaporPrioridadBaremoOpcion2: Array(),
      listaOrdenadaporPrioridadBaremoOpcion3: Array(),
      listaOrdenadaporPrioridadBaremoOpcion4: Array(),
      vacantesDisponibles: 0
    },
    grupoC : {
      listaOrdenadaporPrioridadBaremoOpcion1: Array(),
      listaOrdenadaporPrioridadBaremoOpcion2: Array(),
      listaOrdenadaporPrioridadBaremoOpcion3: Array(),
      listaOrdenadaporPrioridadBaremoOpcion4: Array(),
      vacantesDisponibles: 0
    }
  };


  infoBaseAdmitidos.minusvalido.listaOrdenadaporPrioridadBaremoOpcion1 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 0)).filter(l=>l?.handicapped).sort(sortCandidates);
  infoBaseAdmitidos.minusvalido.listaOrdenadaporPrioridadBaremoOpcion2 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 1)).filter(l=>l?.handicapped).sort(sortCandidates);
  infoBaseAdmitidos.minusvalido.listaOrdenadaporPrioridadBaremoOpcion3 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 2)).filter(l=>l?.handicapped).sort(sortCandidates);
  infoBaseAdmitidos.minusvalido.listaOrdenadaporPrioridadBaremoOpcion4 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 3)).filter(l=>l?.handicapped).sort(sortCandidates);

  infoBaseAdmitidos.deportista.listaOrdenadaporPrioridadBaremoOpcion1 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 0)).filter(l=>l?.eliteAthlete).sort(sortCandidates);
  infoBaseAdmitidos.deportista.listaOrdenadaporPrioridadBaremoOpcion2 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 1)).filter(l=>l?.eliteAthlete).sort(sortCandidates);
  infoBaseAdmitidos.deportista.listaOrdenadaporPrioridadBaremoOpcion3 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 2)).filter(l=>l?.eliteAthlete).sort(sortCandidates);
  infoBaseAdmitidos.deportista.listaOrdenadaporPrioridadBaremoOpcion4 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 3)).filter(l=>l?.eliteAthlete).sort(sortCandidates);

  infoBaseAdmitidos.grupoA.listaOrdenadaporPrioridadBaremoOpcion1 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 0)).filter(l=>l?.viaAcceso=='A').sort(sortCandidates);
  infoBaseAdmitidos.grupoA.listaOrdenadaporPrioridadBaremoOpcion2 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 1)).filter(l=>l?.viaAcceso=='A').sort(sortCandidates);
  infoBaseAdmitidos.grupoA.listaOrdenadaporPrioridadBaremoOpcion3 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 2)).filter(l=>l?.viaAcceso=='A').sort(sortCandidates);
  infoBaseAdmitidos.grupoA.listaOrdenadaporPrioridadBaremoOpcion4 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 3)).filter(l=>l?.viaAcceso=='A').sort(sortCandidates);

  infoBaseAdmitidos.grupoB.listaOrdenadaporPrioridadBaremoOpcion1 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 0)).filter(l=>l?.viaAcceso=='B').sort(sortCandidates);
  infoBaseAdmitidos.grupoB.listaOrdenadaporPrioridadBaremoOpcion2 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 1)).filter(l=>l?.viaAcceso=='B').sort(sortCandidates);
  infoBaseAdmitidos.grupoB.listaOrdenadaporPrioridadBaremoOpcion3 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 2)).filter(l=>l?.viaAcceso=='B').sort(sortCandidates);
  infoBaseAdmitidos.grupoB.listaOrdenadaporPrioridadBaremoOpcion4 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 3)).filter(l=>l?.viaAcceso=='B').sort(sortCandidates);

  infoBaseAdmitidos.grupoC.listaOrdenadaporPrioridadBaremoOpcion1 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 0)).filter(l=>l?.viaAcceso=='C').sort(sortCandidates);
  infoBaseAdmitidos.grupoC.listaOrdenadaporPrioridadBaremoOpcion2 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 1)).filter(l=>l?.viaAcceso=='C').sort(sortCandidates);
  infoBaseAdmitidos.grupoC.listaOrdenadaporPrioridadBaremoOpcion3 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 2)).filter(l=>l?.viaAcceso=='C').sort(sortCandidates);
  infoBaseAdmitidos.grupoC.listaOrdenadaporPrioridadBaremoOpcion4 = listaSolicitudesAceptadas.map(lop=>mapearDatosIniciales(lop, 3)).filter(l=>l?.viaAcceso=='C').sort(sortCandidates);


  var docIdAdmitidos = Array();
  var cursoAdmitidos = Array();
  
  const asignarCandidato = (prioridad, lista, cursoCentroCicloModulo, candidato, comprobarVacantes = true) => {
    if ((!cursoCentroCicloModulo) || (!candidato) || (comprobarVacantes && cursoCentroCicloModulo.vacantesDisponibles<=0)) return null;
    const vacantesDisponibles = cursoCentroCicloModulo.vacantesDisponibles - candidato.especialNeeds?Number(2):Number(1);
    if (vacantesDisponibles<0) {
      console.log(`TENEMOS UN PROBLEMA PORQUE OCUPA EL DOBLE Y NO HAY PLAZA SOLO PARA 1 : cursoCentroCicloModulo:${cursoCentroCicloModulo} candidato:${candidato} `);
      return null;
    }

    // podemos asignarlo
    cursoCentroCicloModulo.vacantesDisponibles -= candidato.especialNeeds?Number(2):Number(1);
    docIdAdmitidos.push(candidato.applicationId);
    cursoAdmitidos[candidato.applicationId] = prioridad;
    lista.push(candidato);
    lista=lista.sort(sortCandidates);

    if (docIdAdmitidos.filter(l=>l==candidato.applicationId).length>1) {
      console.log(`PARAR DUPLICADOS`)
    }
  }

  const quitarUltimoCandidato = (prioridad, lista, cursoCentroCicloModulo) => {
    const candidatoUltimo = lista.pop();
    docIdAdmitidos = docIdAdmitidos.filter(l=>l!=candidatoUltimo.applicationId);
    cursoCentroCicloModulo.vacantesDisponibles += candidatoUltimo.especialNeeds?Number(2):Number(1);    
    if ((prioridad-(cursoAdmitidos[candidatoUltimo.applicationId] || Number(0)))>0){
      listaDesplazados.push(candidatoUltimo.applicationId);
      listaDesplazados = listaDesplazados.filter((v, i, a) => a.indexOf(v) === i);
    }
  }
  
  const quitarCandidatoTodasListas = (applicationId) => {

    if (!docIdAdmitidos.find(l=>l==applicationId)) return;

    const candidato = listaSolicitudesAceptadas.find(l=>l.applicationId==applicationId);
    if (!candidato) return;

    for (var cursoCentroCicloModulo of listaCentrosCiclosModulos) {
      const antes = `A:${cursoCentroCicloModulo.listaAsignadosA.length} B:${cursoCentroCicloModulo.listaAsignadosB.length} C:${cursoCentroCicloModulo.listaAsignadosC.length} `;
      cursoCentroCicloModulo.listaAsignadosA = cursoCentroCicloModulo.listaAsignadosA.filter(l=>l.applicationId!=applicationId);
      cursoCentroCicloModulo.listaAsignadosB = cursoCentroCicloModulo.listaAsignadosB.filter(l=>l.applicationId!=applicationId);
      cursoCentroCicloModulo.listaAsignadosC = cursoCentroCicloModulo.listaAsignadosC.filter(l=>l.applicationId!=applicationId);
      const despues = `A:${cursoCentroCicloModulo.listaAsignadosA.length} B:${cursoCentroCicloModulo.listaAsignadosB.length} C:${cursoCentroCicloModulo.listaAsignadosC.length} `;
      docIdAdmitidos = docIdAdmitidos.filter(l=>l!=applicationId);
      if (antes!=despues){
        docIdAdmitidos = docIdAdmitidos.filter(l=>l!=applicationId);
        cursoCentroCicloModulo.vacantesDisponibles += candidato.especialNeeds?Number(2):Number(1);
      }
      else {
        if (docIdAdmitidos.find(l=>l==applicationId)) {
          console.log("ERROR");
        }
      }
    }
  }
  
  // Comprobar si los candidatos sin asignar pueden desplazar a los asignados por baremo
  const asignarSiMejorCandidato = (prioridad, cursoCentroCicloModulo, lista, candidato, vacantes, estrictoVacantes = false) => {
    if ((!cursoCentroCicloModulo) || (!lista) || (!candidato) || (vacantes<=0) || (docIdAdmitidos.find(l=>l==candidato.applicationId)?true:false)) return;
    
    // Hay huecos disponibles y el candidato no es repetido
    if (lista.length<vacantes) {
      asignarCandidato(prioridad, lista, cursoCentroCicloModulo, candidato, false);
      return;
    }
    var listaProvisionalOrdenada = JSON.parse(JSON.stringify(lista));
    listaProvisionalOrdenada.push(candidato);
    listaProvisionalOrdenada = listaProvisionalOrdenada.sort(sortCandidates);
    // Si el último es el que hemos metido es porque no mejora
    const candidatoUltimo = listaProvisionalOrdenada.pop();
    if (candidatoUltimo.applicationId!=candidato.applicationId){
      // Mejora veamos si hay huecos y no hace falta borrar
      if ((estrictoVacantes && lista.length<vacantes) || ((!estrictoVacantes) && cursoCentroCicloModulo.vacantesDisponibles>0)) {
        asignarCandidato(prioridad, lista, cursoCentroCicloModulo, candidato, false);
      }
      else{
        quitarUltimoCandidato(prioridad, lista, cursoCentroCicloModulo);
        // Añadimos el nuevo
        asignarCandidato(prioridad, lista, cursoCentroCicloModulo, candidato, false);
      }
    }
  }

  for (var cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    cursoCentroCicloModulo.listaAsignadosDiscapacitados = Array();
    cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera = Array();
    cursoCentroCicloModulo.listaAsignadosDeportistasElite = Array();
    cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera = Array();
    cursoCentroCicloModulo.listaAsignadosA = Array();
    cursoCentroCicloModulo.listaAsignadosAEspera = Array();
    cursoCentroCicloModulo.listaAsignadosB = Array();
    cursoCentroCicloModulo.listaAsignadosBEspera = Array();
    cursoCentroCicloModulo.listaAsignadosC = Array();
    cursoCentroCicloModulo.listaAsignadosCEspera = Array();
    cursoCentroCicloModulo.vacantesDisponibles = cursoCentroCicloModulo.vacantes;
  }

  var listaDesplazados = Array();
  const maxVueltas = 10;
  for (var vuelta=0; vuelta<maxVueltas; vuelta++){ 
    console.log(`------------------------------ VUELTA ${vuelta}------------------------------`);
    const listaCopia = JSON.parse(JSON.stringify(listaDesplazados));
    console.log(`listaCopia longitud ->${listaCopia.length}`);
    listaCopia.forEach(el=>quitarCandidatoTodasListas(el));
    listaDesplazados = Array();

    for (var prioridad=0; prioridad<4; prioridad++){
      var listaCandidatosNoAsignadosMinusvalido = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (l?.handicapped)));
      var listaCandidatosNoAsignadosDeportista = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (l?.eliteAthlete)));
      var listaCandidatosNoAsignadosGrupoA = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (l?.viaAcceso=='A')));
      var listaCandidatosNoAsignadosGrupoB = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (l?.viaAcceso=='B')));
      var listaCandidatosNoAsignadosGrupoC = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (l?.viaAcceso=='C')));
      var countRestantes = listaCandidatosNoAsignadosMinusvalido.length + listaCandidatosNoAsignadosDeportista.length + listaCandidatosNoAsignadosGrupoA.length + listaCandidatosNoAsignadosGrupoB.length + listaCandidatosNoAsignadosGrupoC.length;

      // Discapacitados
      for (const candidato of listaCandidatosNoAsignadosMinusvalido){
        const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
        if (candidatoPosible) {
          const cursoCentroCicloModulo = listaCentrosCiclosModulos.find(l=>(candidatoPosible.centroCicloModulo.codigoCentro==l.codigoCentro) && (candidatoPosible.centroCicloModulo.codigoCurso==l.codigoCurso));
          if (cursoCentroCicloModulo) {
            const vacantesDiscapacitados = redondear(cursoCentroCicloModulo.vacantes * config.percentageHandicap * config.numSlotsBySeatHandicap);
            asignarSiMejorCandidato(prioridad, cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosDiscapacitados, candidatoPosible, vacantesDiscapacitados, true);
          }
        }
      }
      // Deportistas de élite
      for (const candidato of listaCandidatosNoAsignadosDeportista){
        const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
        if (candidatoPosible) {
          const cursoCentroCicloModulo = listaCentrosCiclosModulos.find(l=>(candidatoPosible.centroCicloModulo.codigoCentro==l.codigoCentro) && (candidatoPosible.centroCicloModulo.codigoCurso==l.codigoCurso));
          if (cursoCentroCicloModulo) {
            const vacantesDeportistas = redondear(cursoCentroCicloModulo.vacantes * config.percentageAthlete * config.numSlotsBySeatAthlete);
            asignarSiMejorCandidato(prioridad, cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosDeportistasElite, candidatoPosible, vacantesDeportistas, true);
          }
        }
      }
      // Grupo A ( o resto cuando no hay grupos)
      for (const candidato of listaCandidatosNoAsignadosGrupoA){
        const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
        if (candidatoPosible) {
          const cursoCentroCicloModulo = listaCentrosCiclosModulos.find(l=>(candidatoPosible.centroCicloModulo.codigoCentro==l.codigoCentro) && (candidatoPosible.centroCicloModulo.codigoCurso==l.codigoCurso));
          if (cursoCentroCicloModulo) {   
            const vacantesA = redondear((cursoCentroCicloModulo.vacantes - cursoCentroCicloModulo.listaAsignadosDiscapacitados.length - cursoCentroCicloModulo.listaAsignadosDeportistasElite.length));
            asignarSiMejorCandidato(prioridad, cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosA, candidatoPosible, vacantesA);
          }
        }
      }
      // Grupo B
      for (const candidato of listaCandidatosNoAsignadosGrupoB){
        const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
        if (candidatoPosible) {
          const cursoCentroCicloModulo = listaCentrosCiclosModulos.find(l=>(candidatoPosible.centroCicloModulo.codigoCentro==l.codigoCentro) && (candidatoPosible.centroCicloModulo.codigoCurso==l.codigoCurso));
          if (cursoCentroCicloModulo) {
            const vacantesB = redondear((cursoCentroCicloModulo.vacantes - cursoCentroCicloModulo.listaAsignadosDiscapacitados.length - cursoCentroCicloModulo.listaAsignadosDeportistasElite.length));
            asignarSiMejorCandidato(prioridad, cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosB, candidatoPosible, vacantesB);
          }
        }
      }
      // Grupo C
      for (const candidato of listaCandidatosNoAsignadosGrupoC){
        const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
        if (candidatoPosible) {
          const cursoCentroCicloModulo = listaCentrosCiclosModulos.find(l=>(candidatoPosible.centroCicloModulo.codigoCentro==l.codigoCentro) && (candidatoPosible.centroCicloModulo.codigoCurso==l.codigoCurso));
          if (cursoCentroCicloModulo) {
            const vacantesC = redondear((cursoCentroCicloModulo.vacantes - cursoCentroCicloModulo.listaAsignadosDiscapacitados.length - cursoCentroCicloModulo.listaAsignadosDeportistasElite.length));
            asignarSiMejorCandidato(prioridad, cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosC, candidatoPosible, vacantesC);
          }
        }
      }

      // Balancear vacantes entre los grupos A B y C (para aproximarlos a los porcentajes)
      for (var cursoCentroCicloModulo of listaCentrosCiclosModulos) {
        while (cursoCentroCicloModulo.vacantesDisponibles<0){
          const vacantesIdealesGrupoA = redondear((cursoCentroCicloModulo.vacantes - cursoCentroCicloModulo.listaAsignadosDiscapacitados.length - cursoCentroCicloModulo.listaAsignadosDeportistasElite.length) * config.percentageA);
          const vacantesIdealesGrupoB = redondear((cursoCentroCicloModulo.vacantes - cursoCentroCicloModulo.listaAsignadosDiscapacitados.length - cursoCentroCicloModulo.listaAsignadosDeportistasElite.length) * config.percentageB);
          const vacantesIdealesGrupoC = redondear((cursoCentroCicloModulo.vacantes - cursoCentroCicloModulo.listaAsignadosDiscapacitados.length - cursoCentroCicloModulo.listaAsignadosDeportistasElite.length) * config.percentageC);

          const excesoGrupoA = (cursoCentroCicloModulo.listaAsignadosA.length-vacantesIdealesGrupoA);
          const excesoGrupoB = (cursoCentroCicloModulo.listaAsignadosB.length-vacantesIdealesGrupoB);
          const excesoGrupoC = (cursoCentroCicloModulo.listaAsignadosC.length-vacantesIdealesGrupoC);

          // Quitar primero el que mas vacantes por encima del umbral (comprobar si es el grupo A)
          if ((excesoGrupoA>excesoGrupoB) && (excesoGrupoA>excesoGrupoC)){
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosA, cursoCentroCicloModulo);
          }

          // Quitar primero el que mas vacantes por encima del umbral (comprobar si es el grupo B)
          else if ((excesoGrupoB>excesoGrupoA) && (excesoGrupoB>excesoGrupoC)){
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosB, cursoCentroCicloModulo);
          }

          // Quitar primero el que mas vacantes por encima del umbral (comprobar si es el grupo C)
          else if ((excesoGrupoC>excesoGrupoA) && (excesoGrupoC>excesoGrupoB)){
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosC, cursoCentroCicloModulo);
          }

          // Resto condiciones
          else if (vacantesIdealesGrupoC<cursoCentroCicloModulo.listaAsignadosC.length){
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosC, cursoCentroCicloModulo);
            }
          else if (vacantesIdealesGrupoB<cursoCentroCicloModulo.listaAsignadosB.length){
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosB, cursoCentroCicloModulo);
          } 
          else if (vacantesIdealesGrupoA<cursoCentroCicloModulo.listaAsignadosA.length){
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosA, cursoCentroCicloModulo);
          }
        
          else if (cursoCentroCicloModulo.listaAsignadosC.length>1) {
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosC, cursoCentroCicloModulo);
          } 
          else if (cursoCentroCicloModulo.listaAsignadosB.length>1) {
            quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosB, cursoCentroCicloModulo);
          } 
          else quitarUltimoCandidato(prioridad, cursoCentroCicloModulo.listaAsignadosA, cursoCentroCicloModulo);
        }
      }
    } // For Prioridad
  } // For Vueltas



  //////////////////////////////////////////////////////////////////////////

  for (var cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    cursoCentroCicloModulo.listaAsignadosDiscapacitados = cursoCentroCicloModulo.listaAsignadosDiscapacitados.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosDeportistasElite = cursoCentroCicloModulo.listaAsignadosDeportistasElite.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosA = cursoCentroCicloModulo.listaAsignadosA.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosB = cursoCentroCicloModulo.listaAsignadosB.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosC = cursoCentroCicloModulo.listaAsignadosC.sort(sortCandidates);

    if (cursoCentroCicloModulo.vacantesDisponibles!=0){
      // Encontrar candidatos que tengan este curso
      var candidatosMejoraGrupoA = listaSolicitudesAceptadas.filter(l=>l.viaAcceso=='A' && l.listaCentrosCiclosModulos.find(cccm=>((cccm.codigoCentro==cursoCentroCicloModulo.codigoCentro) && (cccm.codigoCurso==cursoCentroCicloModulo.codigoCurso) )));
      var candidatosMejoraGrupoB = listaSolicitudesAceptadas.filter(l=>l.viaAcceso=='B' && l.listaCentrosCiclosModulos.find(cccm=>((cccm.codigoCentro==cursoCentroCicloModulo.codigoCentro) && (cccm.codigoCurso==cursoCentroCicloModulo.codigoCurso) )));
      var candidatosMejoraGrupoC = listaSolicitudesAceptadas.filter(l=>l.viaAcceso=='C' && l.listaCentrosCiclosModulos.find(cccm=>((cccm.codigoCentro==cursoCentroCicloModulo.codigoCentro) && (cccm.codigoCurso==cursoCentroCicloModulo.codigoCurso) )));

      // Grupo A
      candidatosMejoraGrupoA.filter(l=>!((cursoCentroCicloModulo.listaAsignadosA.map(li=>li.applicationId)).includes(l.applicationId))).forEach (candidato=> {
        var prioridad=0;
        for (prioridad=0; prioridad<candidato.listaCentrosCiclosModulos.length; prioridad++){
          if ((candidato.listaCentrosCiclosModulos[prioridad].codigoCentro==cursoCentroCicloModulo.codigoCentro) && (candidato.listaCentrosCiclosModulos[prioridad].codigoCurso==cursoCentroCicloModulo.codigoCurso)){
            break;
          }
        }
        if (cursoAdmitidos[candidato.applicationId] > prioridad){

          console.log(`Posible candidato Grupo A: ${cursoAdmitidos[candidato.applicationId]} > ${prioridad} -> ${JSON.stringify(candidato.personalId)}`);
          const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
          quitarCandidatoTodasListas(candidatoPosible.applicationId);
          asignarCandidato (prioridad, cursoCentroCicloModulo.listaAsignadosA, cursoCentroCicloModulo, candidatoPosible);
        }
      });
      // Grupo B
      candidatosMejoraGrupoB.filter(l=>!((cursoCentroCicloModulo.listaAsignadosB.map(li=>li.applicationId)).includes(l.applicationId))).forEach (candidato=> {
        var prioridad=0;
        for (prioridad=0; prioridad<candidato.listaCentrosCiclosModulos.length; prioridad++){
          if ((candidato.listaCentrosCiclosModulos[prioridad].codigoCentro==cursoCentroCicloModulo.codigoCentro) && (candidato.listaCentrosCiclosModulos[prioridad].codigoCurso==cursoCentroCicloModulo.codigoCurso)){
            break;
          }
        }
        if (cursoAdmitidos[candidato.applicationId] > prioridad){

          console.log(`Posible candidato Grupo B: ${cursoAdmitidos[candidato.applicationId]} > ${prioridad} -> ${JSON.stringify(candidato.personalId)}`);
          const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
          quitarCandidatoTodasListas(candidatoPosible.applicationId);
          asignarCandidato (prioridad, cursoCentroCicloModulo.listaAsignadosB, cursoCentroCicloModulo, candidatoPosible);
        }
      });
      // Grupo C
      candidatosMejoraGrupoC.filter(l=>!((cursoCentroCicloModulo.listaAsignadosC.map(li=>li.applicationId)).includes(l.applicationId))).forEach (candidato=> {
        var prioridad=0;
        for (prioridad=0; prioridad<candidato.listaCentrosCiclosModulos.length; prioridad++){
          if ((candidato.listaCentrosCiclosModulos[prioridad].codigoCentro==cursoCentroCicloModulo.codigoCentro) && (candidato.listaCentrosCiclosModulos[prioridad].codigoCurso==cursoCentroCicloModulo.codigoCurso)){
            break;
          }
        }
        if (cursoAdmitidos[candidato.applicationId] > prioridad){

          console.log(`Posible candidato Grupo C: ${cursoAdmitidos[candidato.applicationId]} > ${prioridad} -> ${JSON.stringify(candidato.personalId)}`);
          const candidatoPosible = mapearDatosIniciales(candidato, prioridad);
          quitarCandidatoTodasListas(candidatoPosible.applicationId);
          asignarCandidato (prioridad, cursoCentroCicloModulo.listaAsignadosC, cursoCentroCicloModulo, candidatoPosible);
        }
      });
    }
  }

  for (var cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    cursoCentroCicloModulo.listaAsignadosDiscapacitados = cursoCentroCicloModulo.listaAsignadosDiscapacitados.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosDeportistasElite = cursoCentroCicloModulo.listaAsignadosDeportistasElite.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosA = cursoCentroCicloModulo.listaAsignadosA.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosB = cursoCentroCicloModulo.listaAsignadosB.sort(sortCandidates);
    cursoCentroCicloModulo.listaAsignadosC = cursoCentroCicloModulo.listaAsignadosC.sort(sortCandidates);
    if (cursoCentroCicloModulo.vacantesDisponibles!=0){
      console.log(`¿REALMENTE TENEMOS MAS PLAZAS QUE CANDIDATOS?: cursoCentroCicloModulo:${JSON.stringify(cursoCentroCicloModulo.curso)} Plazas disponibles -> ${cursoCentroCicloModulo.vacantesDisponibles} de ${cursoCentroCicloModulo.vacantes} `);
    }
  }



  var listaCandidatosNoAsignadosMinusvalido = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (l?.handicapped)) );
  var listaCandidatosNoAsignadosDeportista = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (!l?.handicapped) && (l?.eliteAthlete)) );
  var listaCandidatosNoAsignadosGrupoA = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (!l?.handicapped) && (!l?.eliteAthlete) && (l?.viaAcceso=='A')) );
  var listaCandidatosNoAsignadosGrupoB = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (!l?.handicapped) && (!l?.eliteAthlete) && (l?.viaAcceso=='B')) );
  var listaCandidatosNoAsignadosGrupoC = listaSolicitudesAceptadas.filter(l=>((!docIdAdmitidos.includes(l.applicationId)) && (!l?.handicapped) && (!l?.eliteAthlete) && (l?.viaAcceso=='C')) );
  var countRestantes = listaCandidatosNoAsignadosMinusvalido.length + listaCandidatosNoAsignadosDeportista.length + listaCandidatosNoAsignadosGrupoA.length + listaCandidatosNoAsignadosGrupoB.length + listaCandidatosNoAsignadosGrupoC.length;
  console.log(`-----------------------------`)
  console.log(`Total admitidos: ${docIdAdmitidos.length} de ${listaSolicitudesAceptadas.length}`)
  console.log(`Total sin admitidos: ${countRestantes} de ${listaSolicitudesAceptadas.length}`)
  console.log(`Total admitidos + sin admitidos: ${docIdAdmitidos.length+countRestantes} de ${listaSolicitudesAceptadas.length}`)

  console.log(`---Quitar repetidos---`)
  // Quitar repetidos
  docIdAdmitidos = docIdAdmitidos.filter((v, i, a) => a.indexOf(v) === i);
  console.log(`Total admitidos: ${docIdAdmitidos.length} de ${listaSolicitudesAceptadas.length}`)
  console.log(`Total sin admitidos: ${countRestantes} de ${listaSolicitudesAceptadas.length}`)
  console.log(`Total admitidos + sin admitidos: ${docIdAdmitidos.length+countRestantes} de ${listaSolicitudesAceptadas.length}`)
  console.log(`-----------------------------`)



  // Procesar listas de espera
  var listaSolicitudesAceptadasCopia = JSON.parse(JSON.stringify(listaSolicitudesAceptadas));
  var listaAsignadosTotal = JSON.parse(JSON.stringify(docIdAdmitidos));

  // Los que no están asignados en ningún sitio
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    const claveCurso = (cursoCentroCicloModulo.codigoCentro || '') + "_" + (cursoCentroCicloModulo.codigoCurso || '') + "_" + (cursoCentroCicloModulo.codigoModulo || '');
    cursoCentroCicloModulo.listaAsignadosAEspera = listaSolicitudesAceptadasCopia.filter(sol => (
      (String(sol.viaAcceso).toLocaleUpperCase()=='A') &&
        ((sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)) &&
          (!listaAsignadosTotal.includes(sol.applicationId)))).map(s=>{ if (!s.preferencia) {s.preferencia=Array();}; s.preferencia[claveCurso] = s.listaCentrosCiclosModulos.find(l=>String ((l.codigoCentro || '') + "_" + (l.codigoCurso || '') + "_" + (l.codigoModulo || ''))==claveCurso).prioridad; 
            return s;});
    cursoCentroCicloModulo.listaAsignadosBEspera = listaSolicitudesAceptadasCopia.filter(sol => (
      (String(sol.viaAcceso).toLocaleUpperCase()=='B') &&
        ((sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)) &&
          (!listaAsignadosTotal.includes(sol.applicationId)))).map(s=>{ if (!s.preferencia) {s.preferencia=Array();}; s.preferencia[claveCurso] = s.listaCentrosCiclosModulos.find(l=>String ((l.codigoCentro || '') + "_" + (l.codigoCurso || '') + "_" + (l.codigoModulo || ''))==claveCurso).prioridad; 
            return s;});
    cursoCentroCicloModulo.listaAsignadosCEspera = listaSolicitudesAceptadasCopia.filter(sol => (
      (String(sol.viaAcceso).toLocaleUpperCase()=='C') &&
        ((sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)) &&
          (!listaAsignadosTotal.includes(sol.applicationId)))).map(s=>{ if (!s.preferencia) {s.preferencia=Array();}; s.preferencia[claveCurso] = s.listaCentrosCiclosModulos.find(l=>String ((l.codigoCentro || '') + "_" + (l.codigoCurso || '') + "_" + (l.codigoModulo || ''))==claveCurso).prioridad; 
            return s;});
}

  // Añadir los que tienen mejores opciones Lista A
  listaSolicitudesAceptadasCopia.filter(lsa=>(String(lsa.viaAcceso).toLocaleUpperCase()=='A') && listaAsignadosTotal.includes(lsa.applicationId)).map(ap=>{
    // Buscamos el centro que nos han asignado
    listaCentrosCiclosModulos.map(lccm=> {

      var found = lccm.listaAsignadosDiscapacitados.find(lccmd=>lccmd.applicationId == ap.applicationId);
      if (!found) {
        found = lccm.listaAsignadosDeportistasElite.find(lccme=>lccme.applicationId == ap.applicationId);
      }
      if (!found) {
        found = lccm.listaAsignadosA.find(lccma=>lccma.applicationId == ap.applicationId);
      }
      if (found) {
        // Obtenemos la posición/prioridad de la solicitud
        const claveCurso = (lccm.codigoCentro || '') + "_" + (lccm.codigoCurso || '') + "_" + (lccm.codigoModulo || '');
        for (var indexAsignado=0; indexAsignado<ap.listaCentrosCiclosModulos.length; indexAsignado++){
          const claveCursoAp = (ap.listaCentrosCiclosModulos[indexAsignado].codigoCentro || '') + "_" + (ap.listaCentrosCiclosModulos[indexAsignado].codigoCurso || '') + "_" + (ap.listaCentrosCiclosModulos[indexAsignado].codigoModulo || '');
          if (claveCurso==claveCursoAp){
            // Asignar a la lista de espera todos los anteriores
            for (var j=0; j<indexAsignado;j++){

              // Buscar el centro
              const claveAnterior =  (ap.listaCentrosCiclosModulos[j].codigoCentro || '') + "_" + (ap.listaCentrosCiclosModulos[j].codigoCurso || '') + "_" + (ap.listaCentrosCiclosModulos[j].codigoModulo || '');
              const centroEncontrado =listaCentrosCiclosModulos.find(s=>String((s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))==claveAnterior);
              if (centroEncontrado) {
                if (!ap.preferencia) { ap.preferencia = Array(); }
                ap.preferencia[claveAnterior] = ap.listaCentrosCiclosModulos[j].prioridad;
                centroEncontrado.listaAsignadosAEspera.push(ap);
              }
            }
            break;
            }
        }
      }
    });
  });

  // Añadir los que tienen mejores opciones Lista B
  listaSolicitudesAceptadasCopia.filter(lsa=>(String(lsa.viaAcceso).toLocaleUpperCase()=='B') && listaAsignadosTotal.includes(lsa.applicationId)).map(ap=>{
    // Buscamos el centro que nos han asignado
    listaCentrosCiclosModulos.map(lccm=> {

      var found = lccm.listaAsignadosDiscapacitados.find(lccmd=>lccmd.applicationId == ap.applicationId);
      if (!found) {
        found = lccm.listaAsignadosDeportistasElite.find(lccme=>lccme.applicationId == ap.applicationId);
      }
      if (!found) {
        found = lccm.listaAsignadosB.find(lccma=>lccma.applicationId == ap.applicationId);
      }
      if (found) {
        // Obtenemos la posición/prioridad de la solicitud
        const claveCurso = (lccm.codigoCentro || '') + "_" + (lccm.codigoCurso || '') + "_" + (lccm.codigoModulo || '');
        for (var indexAsignado=0; indexAsignado<ap.listaCentrosCiclosModulos.length; indexAsignado++){
          const claveCursoAp = (ap.listaCentrosCiclosModulos[indexAsignado].codigoCentro || '') + "_" + (ap.listaCentrosCiclosModulos[indexAsignado].codigoCurso || '') + "_" + (ap.listaCentrosCiclosModulos[indexAsignado].codigoModulo || '');
          if (claveCurso==claveCursoAp){
            // Asignar a la lista de espera todos los anteriores
            for (var j=0; j<indexAsignado;j++){

              // Buscar el centro
              const claveAnterior =  (ap.listaCentrosCiclosModulos[j].codigoCentro || '') + "_" + (ap.listaCentrosCiclosModulos[j].codigoCurso || '') + "_" + (ap.listaCentrosCiclosModulos[j].codigoModulo || '');
              const centroEncontrado =listaCentrosCiclosModulos.find(s=>String((s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))==claveAnterior);
              if (centroEncontrado) {
                if (!ap.preferencia) { ap.preferencia = Array(); }
                ap.preferencia[claveAnterior] = ap.listaCentrosCiclosModulos[j].prioridad;
                centroEncontrado.listaAsignadosBEspera.push(ap);
              }
            }
            break;
            }
        }
      }
    });
  });
  // Añadir los que tienen mejores opciones Lista C
  listaSolicitudesAceptadasCopia.filter(lsa=>(String(lsa.viaAcceso).toLocaleUpperCase()=='C') && listaAsignadosTotal.includes(lsa.applicationId)).map(ap=>{
    // Buscamos el centro que nos han asignado
    listaCentrosCiclosModulos.map(lccm=> {

      var found = lccm.listaAsignadosDiscapacitados.find(lccmd=>lccmd.applicationId == ap.applicationId);
      if (!found) {
        found = lccm.listaAsignadosDeportistasElite.find(lccme=>lccme.applicationId == ap.applicationId);
      }
      if (!found) {
        found = lccm.listaAsignadosC.find(lccma=>lccma.applicationId == ap.applicationId);
      }
      if (found) {
        // Obtenemos la posición/prioridad de la solicitud
        const claveCurso = (lccm.codigoCentro || '') + "_" + (lccm.codigoCurso || '') + "_" + (lccm.codigoModulo || '');
        for (var indexAsignado=0; indexAsignado<ap.listaCentrosCiclosModulos.length; indexAsignado++){
          const claveCursoAp = (ap.listaCentrosCiclosModulos[indexAsignado].codigoCentro || '') + "_" + (ap.listaCentrosCiclosModulos[indexAsignado].codigoCurso || '') + "_" + (ap.listaCentrosCiclosModulos[indexAsignado].codigoModulo || '');
          if (claveCurso==claveCursoAp){
            // Asignar a la lista de espera todos los anteriores
            for (var j=0; j<indexAsignado;j++){

              // Buscar el centro
              const claveAnterior =  (ap.listaCentrosCiclosModulos[j].codigoCentro || '') + "_" + (ap.listaCentrosCiclosModulos[j].codigoCurso || '') + "_" + (ap.listaCentrosCiclosModulos[j].codigoModulo || '');
              const centroEncontrado =listaCentrosCiclosModulos.find(s=>String((s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))==claveAnterior);
              if (centroEncontrado) {
                if (!ap.preferencia) { ap.preferencia = Array(); }
                ap.preferencia[claveAnterior] = ap.listaCentrosCiclosModulos[j].prioridad;
                centroEncontrado.listaAsignadosCEspera.push(ap);
              }
            }
            break;
            }
        }
      }
    });
  });

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
            .replace('##textCETitleGeneral##', config.textCETitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textCETypeGeneral##', config.textCETypeGeneral)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
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
            .replace('##textCEDTitleGeneral##', config.textCEDTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textCEDTypeGeneral##', config.textCEDTypeAthlete)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
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
            .replace('##textCEDTitleGeneral##', config.textCEDTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textCEDTypeGeneral##', config.textCEDTypeGeneral)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
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
        const clave =  (cursoCentroCicloModulo.codigoCentro || '') + "_" + (cursoCentroCicloModulo.codigoCurso || '') + "_" + (cursoCentroCicloModulo.codigoModulo || '');
        cursoCentroCicloModulo.listaAsignadosAEspera.sort(sortCandidatesEspera(clave)).map(ap => {
          if (orden%numLinesPerPage==0){
            htmlListaEspera += esperaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textCEDTitleGeneral##', config.textCEDTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##textCEDTypeGeneral##', config.textCEDTypeGeneral)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring.toFixed(3)}</td>`;
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
    listaSolicitudesNoACEDtadas.sort(function(a,b){return (String(a.personalId.substr(a.personalId.indexOf(', ') + 2)).localeCompare(String(b.personalId.substr(b.personalId.indexOf(', ') + 2))))}).map(ap => {
      if (orden%numLinesPerPage==0){
        htmlListaExcluidos += excluidosBaseHtml.toString()
        .replace('##titleGeneral##', config.titleGeneral)
        .replace('##textCEDTitleGeneral##', config.textCEDTitleGeneral)
        .replace('##city##', city)
        .replace('##titleCurse##', config.titleCurse)
        .replace('##titleRejected##', config.titleRejected)
        .replace('##textCEDTypeGeneral##', config.textCEDTypeGeneral)
        .replace('##titleWarning##', config.titleWarning)
      }  

      htmlListaExcluidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
      htmlListaExcluidos += `	  <td>${orden}</td>`;
      htmlListaExcluidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${generarTextoExclusionCED(ap.incumple)}</td>`;
      htmlListaExcluidos += `  </tr>`;
      contentExcluidosExcel+= `${(orden || '')};${ap.docId ? `${ap.docId}` : 'Ninguno'};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};${ap.incumple};${generarTextoExclusionCED(ap.incumple)}\r\n`;
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
