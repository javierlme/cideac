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

  const generarTextoExclusionGS = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo+=config.textGSR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo+=config.textGSR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo+=config.textGSR3 + ' / ';
    return motivo.slice(0,-2)
  }

  const generarTextoModulo = (codigoModulo) => {
    const found = listaCentrosCiclosModulos.find(lccm=>String(lccm.codigoModulo)==String(codigoModulo));
    return found? found.abreviaturaModulo : codigoModulo;
  }

  let rowIndex = 2;
  let infoSolicitud;
  const validateAndAppendCourse = (field, mod1, mod2, mod3, mod4, mod5, mod6, mod7, mod8, mod9, mod10, infoSolicitud, prioridad, textoCursoCompleto, mandatory = false) => {
    var cursoCompleto = false;
    const curso   = readCell(field, rowIndex).split(' ')[0]
    var listaModulos = Array();
    const modulo1 = readCell(mod1,  rowIndex).split('#')[0];
    const modulo2 = readCell(mod2,  rowIndex).split('#')[0];
    const modulo3 = readCell(mod3,  rowIndex).split('#')[0];
    const modulo4 = readCell(mod4,  rowIndex).split('#')[0];
    const modulo5 = readCell(mod5,  rowIndex).split('#')[0];
    const modulo6 = readCell(mod6,  rowIndex).split('#')[0];
    const modulo7 = readCell(mod7,  rowIndex).split('#')[0];
    const modulo8 = readCell(mod8,  rowIndex).split('#')[0];
    const modulo9 = readCell(mod9,  rowIndex).split('#')[0];
    const modulo10=  readCell(mod10, rowIndex).split('#')[0];
    if (modulo1!='')  { listaModulos.push(curso + modulo1); }
    if (modulo2!='')  { listaModulos.push(curso + modulo2); }
    if (modulo3!='')  { listaModulos.push(curso + modulo3); }
    if (modulo4!='')  { listaModulos.push(curso + modulo4); }
    if (modulo5!='')  { listaModulos.push(curso + modulo5); }
    if (modulo6!='')  { listaModulos.push(curso + modulo6); }
    if (modulo7!='')  { listaModulos.push(curso + modulo7); }
    if (modulo8!='')  { listaModulos.push(curso + modulo8); }
    if (modulo9!='')  { listaModulos.push(curso + modulo9); }
    if (modulo10!='') { listaModulos.push(curso + modulo10);}
    if ((listaModulos.length==0) && (curso.length>0)) {
      cursoCompleto = true;
      const key = String(readCell(field, rowIndex).split(' ')[0] + readCell(field, rowIndex).split('#')[1].split(' ')[1].split('-')[0]);
      listaModulos = listaCentrosCiclosModulos.filter(lccm=>((String(lccm.numeroCurso)==String('1')) && (key==String(lccm.codigoCentro+lccm.codigoCurso))))
        .map(lccm=>String (lccm.codigoCentro+lccm.codigoCurso+lccm.codigoModulo));
    }
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
    var listaModulosComprobados = Array();
    for (const modulo of listaModulos) {
      const selectedCourse = listaCentrosCiclosModulos.find(c =>(String(c.codigoCentro+c.codigoCurso+c.codigoModulo)==modulo));
      if (selectedCourse == null) {
        throw {
          httpCode: 400, codigoCurso: 'ERR_INVALID_COURSE',
          additionalInfo: {
            rowIndex,
            desc: `Centro Curso ${curso} o módulo inválido ${modulo} en la fila ${rowIndex}`
          }
        };
      } else {
        const centrosCiclosModulo = {
          codigoCentro: selectedCourse.codigoCentro,
          centro: selectedCourse.centro,
          codigoCurso: selectedCourse.codigoCurso,
          curso: selectedCourse.curso,
          codigoModulo: selectedCourse.codigoModulo,
          modulo: selectedCourse.modulo,
          abreviaturaModulo: selectedCourse.abreviaturaModulo,
          prioridad: prioridad,
          cursoCompleto: cursoCompleto,
          textoCursoCompleto: textoCursoCompleto
        }
        listaModulosComprobados.push(centrosCiclosModulo);
      }
    }
    infoSolicitud.listaCentrosCiclosModulos.push(listaModulosComprobados)
  }

  // Leer del excel los datos de las listaSolicitudesAceptadas
  while (readCell('A', rowIndex) != '') {
    infoSolicitud = {
      docId: readCell('A', rowIndex),
      applicationId: readCell('B', rowIndex),
      randomNumber: Number(readCell('C', rowIndex).replace(',','')),
      personalId: readCell('D', rowIndex),
      especialNeeds: false,
      listaCentrosCiclosModulos: Array()
    };  
    validateAndAppendCourse('I', 'K',  'L',  'M',  'N',  'O',  'P',  'Q',  'R',  'S',  'T',  infoSolicitud, ['si','sí'].includes(readCell('U',  rowIndex).toLowerCase()), readCell('J', rowIndex));
    validateAndAppendCourse('W', 'Y',  'Z',  'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', infoSolicitud, ['si','sí'].includes(readCell('AI', rowIndex).toLowerCase()), readCell('X', rowIndex));
    validateAndAppendCourse('AK','AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', infoSolicitud, ['si','sí'].includes(readCell('AW', rowIndex).toLowerCase()), readCell('AL', rowIndex));
    validateAndAppendCourse('AY','BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', infoSolicitud, ['si','sí'].includes(readCell('BK', rowIndex).toLowerCase()), readCell('AZ', rowIndex));
    infoSolicitud.viaAcceso = readCell('H', rowIndex);
    infoSolicitud.scoring = Number(readCell('BO', rowIndex).replace('.','').replace(',','.'));
    infoSolicitud.handicapped = ['si','sí'].includes(readCell('BQ', rowIndex).toLowerCase());
    infoSolicitud.eliteAthlete =  ['si','sí'].includes(readCell('BR', rowIndex).toLowerCase());
    infoSolicitud.incumple =  readCell('BS', rowIndex).toLowerCase();
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
  const mapearLinealmenteDatosIniciales = (registro, index) => { 
    if ((!registro) || (![0,1,2,3].includes(index)) || (!registro.listaCentrosCiclosModulos[index])) return null;
    const listaModulos = Array();
    
    registro.listaCentrosCiclosModulos[index].map(modulo=>{
      listaModulos.push( {
        applicationId: registro.applicationId,
        asignado: false,
        espera: true,
        prioridadPeticion: index,
        preferencia: modulo.prioridad? modulo.prioridad : false,
        scoring : registro.scoring? Number(registro.scoring) : Number(0),
        viaAcceso: registro.viaAcceso? registro.viaAcceso.toLocaleUpperCase() : '',
        eliteAthlete: registro.eliteAthlete? registro.eliteAthlete : false,
        handicapped: registro.handicapped? registro.handicapped : false,
        especialNeeds: registro.especialNeeds? registro.especialNeeds : false,
        randomNumber: Number(registro.randomNumber),
        docId: registro.docId,
        personalId: registro.personalId,
        claveCentroCicloModulo: generarClave(modulo),
        centro: modulo.centro || '',
        codigoCentro: modulo.codigoCentro || '',
        curso: modulo.curso || '',
        codigoCurso: modulo.codigoCurso || '',
        modulo: modulo.modulo || '',
        codigoModulo: modulo.codigoModulo || '',
        textoCursoCompleto: modulo.textoCursoCompleto || '',
        cursoCompleto: modulo.cursoCompleto? true:false,
        abreviaturaModulo: generarTextoModulo(modulo.codigoModulo)
      })
    });
    return listaModulos;
  }

  const ordenarCandidatos = (c1, c2) => {
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
  }

  const listaSolicitudesAceptadasMapeadas = listaSolicitudesAceptadas.reduce(function(listaAcumulada, solicitud){
    for (var i=0; i<4; i++){
      const listaModulos = mapearLinealmenteDatosIniciales(solicitud, i);
      if ((listaModulos) && (listaModulos!=null)){
        listaAcumulada = listaAcumulada.concat(listaModulos);
      }
    }
    return listaAcumulada;
  },Array()).sort(ordenarCandidatos)

  const rellenarCandidatos = (cursoCentroCicloModulo, prioridadPeticion, vacantesSolicitadas, listaCandidatosFiltradosOrdenados, tipoVacantesPendientes, valorEspera=true) => {
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
        candidatoSelecionado.asignado = true;
        candidatoSelecionado.espera = false;
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo && lsam.prioridadPeticion==prioridadPeticion)).map(l=>l.asignado=true);
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo&& lsam.prioridadPeticion>=prioridadPeticion)).map(l=>l.espera=false);
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo&& lsam.prioridadPeticion<prioridadPeticion)).map(l=>l.espera=valorEspera);
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

  const mejorarPosicionesCandidatos = (cursoCentroCicloModulo, listaAsignados, listaCandidatos, valorEspera=true) => {

    if (!Array.isArray(listaAsignados) || !Array.isArray(listaCandidatos) || listaAsignados.length==0 || listaCandidatos.length==0) return listaAsignados;

    const longitudLista=listaAsignados.length;

    const copia = listaAsignados.concat(listaCandidatos).sort(ordenarCandidatos);
    listaAsignados.forEach(la=>{
      cursoCentroCicloModulo.vacantesDisponibles += la.especialNeeds?Number(2):Number(1);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==la.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo)).map(l=>l.espera=true);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==la.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo)).map(l=>l.asignado=false);
    });

    listaAsignados = Array();
    for (var i=0; i<longitudLista; i++){
      const candidatoSelecionado = copia[i];
      // Anotar candidato
      listaAsignados.push(candidatoSelecionado);
      cursoCentroCicloModulo.vacantesDisponibles -= candidatoSelecionado.especialNeeds?Number(2):Number(1);
      candidatoSelecionado.asignado = true;
      candidatoSelecionado.espera = false;
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo && lsam.prioridadPeticion==candidatoSelecionado.prioridadPeticion)).map(l=>l.asignado=true);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo && lsam.prioridadPeticion>=candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=false);
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==candidatoSelecionado.applicationId && lsam.claveCentroCicloModulo==candidatoSelecionado.claveCentroCicloModulo && lsam.prioridadPeticion<candidatoSelecionado.prioridadPeticion)).map(l=>l.espera=valorEspera);
    }
    return listaAsignados;
  }
  

  // Generamos las lista de solicitantespor los 5 grupos (minusvalidos, deportistas, A, B y C)
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
      cursoCentroCicloModulo.listaAsignadosDiscapacitados = mejorarPosicionesCandidatos(cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosDiscapacitados, listaSolicitantesDiscapacitados, false);
      const listaSolicitantesDeportistasElite = listaSolicitudesAceptadasMapeadas.filter(lsam=>(!lsam.asignado && lsam.espera && opcionSolicitud>=lsam.prioridadPeticion && cursoCentroCicloModulo.claveCentroCicloModulo==lsam.claveCentroCicloModulo && lsam.eliteAthlete)).sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = mejorarPosicionesCandidatos(cursoCentroCicloModulo, cursoCentroCicloModulo.listaAsignadosDeportistasElite, listaSolicitantesDeportistasElite, false);

      // Asignamos % fijo de vacantes a minusválidos
      const vacantesMinusvalidos = redondear(cursoCentroCicloModulo.vacantes * config.percentageHandicap);
      if (vacantesMinusvalidos>cursoCentroCicloModulo.listaAsignadosDiscapacitados.length) {
        cursoCentroCicloModulo.listaAsignadosDiscapacitados = cursoCentroCicloModulo.listaAsignadosDiscapacitados.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, vacantesMinusvalidos, listaSolicitantesDiscapacitados, 'vacantesPendientesDiscapacitados', false)).sort(ordenarCandidatos);
      }
      // Asignamos % fijo de vacantes a deportistas de élite
      const vacantesDeportistas = redondear(cursoCentroCicloModulo. vacantes * config.percentageAthlete);
      if (vacantesDeportistas>cursoCentroCicloModulo.listaAsignadosDeportistasElite.length) {
        cursoCentroCicloModulo.listaAsignadosDeportistasElite = cursoCentroCicloModulo.listaAsignadosDeportistasElite.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, vacantesDeportistas, listaSolicitantesDeportistasElite, 'vacantesPendientesDeportistasElite', false)).sort(ordenarCandidatos);
      }
    }
  }
  const MaxVueltas = 4;
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

        if (listaSolicitantesA.length>0){
          console.log(JSON.stringify(listaSolicitantesA))
        }

        // Asignamos al Grupo A (los que podamos dentro del rango del %)
        cursoCentroCicloModulo.listaAsignadosA = cursoCentroCicloModulo.listaAsignadosA.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, redondear((cursoCentroCicloModulo.vacantes-cursoCentroCicloModulo.listaAsignadosDiscapacitados.length-cursoCentroCicloModulo.listaAsignadosDeportistasElite.length) * config.percentageA), 
            listaSolicitantesA, 'vacantesPendientesA')).sort(ordenarCandidatos);

        // Asignamos al Grupo B (los que podamos dentro del rango del %)
        cursoCentroCicloModulo.listaAsignadosB = cursoCentroCicloModulo.listaAsignadosB.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, redondear((cursoCentroCicloModulo.vacantes-cursoCentroCicloModulo.listaAsignadosDiscapacitados.length-cursoCentroCicloModulo.listaAsignadosDeportistasElite.length) * config.percentageB), 
            listaSolicitantesB, 'vacantesPendientesB')).sort(ordenarCandidatos);

        // Asignamos al Grupo C (los que podamos dentro del rango del %)
        cursoCentroCicloModulo.listaAsignadosC = cursoCentroCicloModulo.listaAsignadosC.concat(
          rellenarCandidatos(cursoCentroCicloModulo, opcionSolicitud, redondear((cursoCentroCicloModulo.vacantes-cursoCentroCicloModulo.listaAsignadosDiscapacitados.length-cursoCentroCicloModulo.listaAsignadosDeportistasElite.length) * config.percentageC), 
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

      cursoCentroCicloModulo.vacantesDisponibles = cursoCentroCicloModulo.vacantes - (cursoCentroCicloModulo.listaAsignadosDiscapacitados.length + cursoCentroCicloModulo.listaAsignadosDeportistasElite.length + cursoCentroCicloModulo.listaAsignadosA.length + cursoCentroCicloModulo.listaAsignadosB.length + cursoCentroCicloModulo.listaAsignadosC.length);
      
    }  
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

    cursoCentroCicloModulo.vacantesDisponibles = cursoCentroCicloModulo.vacantes - (cursoCentroCicloModulo.listaAsignadosDiscapacitados.length + cursoCentroCicloModulo.listaAsignadosDeportistasElite.length + cursoCentroCicloModulo.listaAsignadosA.length + cursoCentroCicloModulo.listaAsignadosB.length + cursoCentroCicloModulo.listaAsignadosC.length);
    
    if (cursoCentroCicloModulo.vacantesDisponibles!=cursoCentroCicloModulo.vacantes) {
      console.log(`----------------- ${cursoCentroCicloModulo.centro || ''} ${cursoCentroCicloModulo.curso || ''} ${cursoCentroCicloModulo.modulo || ''} (${cursoCentroCicloModulo.claveCentroCicloModulo})-----------------`);
      console.log(`Discapacitados ${cursoCentroCicloModulo.listaAsignadosDiscapacitados.length}`);
      console.log(`Deportitas     ${cursoCentroCicloModulo.listaAsignadosDeportistasElite.length}`);
      console.log(`Grupo A        ${cursoCentroCicloModulo.listaAsignadosA.length}`);
      console.log(`Grupo B        ${cursoCentroCicloModulo.listaAsignadosB.length}`);
      console.log(`Grupo C        ${cursoCentroCicloModulo.listaAsignadosC.length}`);
      console.log(`Total          ${cursoCentroCicloModulo.listaAsignadosDiscapacitados.length + cursoCentroCicloModulo.listaAsignadosDeportistasElite.length + cursoCentroCicloModulo.listaAsignadosA.length + cursoCentroCicloModulo.listaAsignadosB.length + cursoCentroCicloModulo.listaAsignadosC.length}`)
      console.log(`Vacantes disponibles ${cursoCentroCicloModulo.vacantesDisponibles} de ${cursoCentroCicloModulo.vacantes}`);
    }
  }
   
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


  const filename = `${category}_${Date.now()}_`;
  const contentHeaderFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'headerBase.html'));
  const admitidosBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `admitidosBase${category}.html`));
  const esperaBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `esperaBase${category}.html`));
  const excluidosBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `excluidosBase${category}.html`));

  var contentAdmitidosExcel = 'ORDEN;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CICLO;DNI;IDENTIFICACION;LISTA;PREFERENCIA;PUNTUACION;' +
  'MINUSVALÍA;ATLETA;\r\n';
  var contentEsperaExcel = 'ORDEN;CODIGO CENTRO;NOMBRE CENTRO;CODIGO DE CICLO;NOMBRE DE CICLO;DNI;IDENTIFICACION;LISTA;PREFERENCIA;PUNTUACION;' +
  'MINUSVALÍA;ATLETA;\r\n';
  var contentExcluidosExcel = 'NUMERO;NOMBRE;MOTIVO EXCLUSION;\r\n';

  if (contentHeaderFile && admitidosBaseHtml && esperaBaseHtml){

    let htmlListaAdmitidos = contentHeaderFile.toString();
    let htmlListaEspera = contentHeaderFile.toString();
    let htmlListaExcluidos = contentHeaderFile.toString();
    const numLinesPerPage = 50;


    const listaCentrosCiclosModulosAgrupada = Array();
    var listaAsignadosA = Array();
    var listaAsignadosAEspera = Array();
    var listaAsignadosB = Array();
    var listaAsignadosBEspera = Array();
    var listaAsignadosC = Array();
    var listaAsignadosCEspera = Array();
    var listaAsignadosDeportistasElite = Array();
    var listaAsignadosDiscapacitados = Array();
  
    var keyAnterior = String('');

    listaCentrosCiclosModulos.forEach(lccm => {

      const key = String(lccm.codigoCentro + '_' + lccm.codigoCurso);
      if (keyAnterior!=key){
        keyAnterior = key;
        listaAsignadosA = Array();
        listaAsignadosAEspera = Array();
        listaAsignadosB = Array();
        listaAsignadosBEspera = Array();
        listaAsignadosC = Array();
        listaAsignadosCEspera = Array();
        listaAsignadosDeportistasElite = Array();
        listaAsignadosDeportistasEliteEspera = Array();
        listaAsignadosDiscapacitados = Array();
        listaAsignadosDiscapacitadosEspera = Array();
      }
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosA))) {
        const datosAux = listaAsignadosA.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosA.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosAEspera))) {
        const datosAux = listaAsignadosAEspera.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosAEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosB))) {
        const datosAux = listaAsignadosB.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosB.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosBEspera))) {
        const datosAux = listaAsignadosBEspera.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosBEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosC))) {
        const datosAux = listaAsignadosC.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosC.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosCEspera))) {
        const datosAux = listaAsignadosCEspera.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosCEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDeportistasElite))) {
        const datosAux = listaAsignadosDeportistasElite.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosDeportistasElite.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDiscapacitados))) {
        const datosAux = listaAsignadosDiscapacitados.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          listaAsignadosDiscapacitados.push(data);
        }
      };
      
      var datosListaCentrosCiclosModulosAgrupada = listaCentrosCiclosModulosAgrupada.find(lccma=>String(lccma.codigoCentro + '_' + lccma.codigoCurso)==key);
      if (!datosListaCentrosCiclosModulosAgrupada){
        const centroCiclo = {
          codigoCentro: lccm.codigoCentro,
          centro: lccm.centro,
          codigoCurso: lccm.codigoCurso,
          curso: lccm.curso,
          listaAsignadosA: listaAsignadosA,
          listaAsignadosAEspera: listaAsignadosAEspera,
          listaAsignadosB: listaAsignadosB,
          listaAsignadosBEspera: listaAsignadosBEspera,
          listaAsignadosC: listaAsignadosC,
          listaAsignadosCEspera: listaAsignadosCEspera,
          listaAsignadosDeportistasElite: listaAsignadosDeportistasElite,
          listaAsignadosDiscapacitados: listaAsignadosDiscapacitados,
        }
        listaCentrosCiclosModulosAgrupada.push(centroCiclo);
      }
    });

    // Ordenar todas las listas
    for (const cursoCentroCicloModulo of listaCentrosCiclosModulosAgrupada) {

    // Generar lista admitidos
      
      // Asignados discapacitados
      var orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDiscapacitados.length>0) {
        cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(ap => {
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeHandicap)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
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
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeAthlete)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += '</table>';
            htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaAdmitidos += `</table>`;
        htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
      }

      // Asignados resto lista A
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosA.length>0) {
        cursoCentroCicloModulo.listaAsignadosA.map(ap => {
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeA)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += '</table>';
            htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaAdmitidos += `</table>`;
        htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
      }
      // Asignados resto lista B
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosB.length>0) {
        cursoCentroCicloModulo.listaAsignadosB.map(ap => {
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeB)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += '</table>';
            htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaAdmitidos += `</table>`;
        htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
      }
      // Asignados resto lista C
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosC.length>0) {
        cursoCentroCicloModulo.listaAsignadosC.map(ap => {
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += admitidosBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeC)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaAdmitidos += '</table>';
            htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaAdmitidos += `</table>`;
        htmlListaAdmitidos += `<div style="page-break-after:always"></div>`;
      }

      // Generar lista espera resto lista A
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosAEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosAEspera.map(ap => {
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaEspera += esperaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeA)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `   <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaEspera += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaEspera += '</table>';
            htmlListaEspera += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaEspera += `</table>`;
        htmlListaEspera += `<div style="page-break-after:always"></div>`;
      }
      // Generar lista espera resto lista B
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosBEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosBEspera.map(ap => {
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaEspera += esperaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeB)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `   <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaEspera += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
          if (orden%numLinesPerPage==0){
            htmlListaEspera += '</table>';
            htmlListaEspera += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaEspera += `</table>`;
        htmlListaEspera += `<div style="page-break-after:always"></div>`;
      }
      // Generar lista espera resto lista C
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosCEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosCEspera.map(ap => {
          const textoCursoCompletoModulos = ap.cursoCompleto? ap.textoCursoCompleto : ap.listaCentrosCiclosModulos.map(l=>l).join(' ')
          if (orden%numLinesPerPage==0){
            htmlListaEspera += esperaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeC)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaEspera += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCurso || '')};${(cursoCentroCicloModulo.curso || '')};${(ap.docId || '')};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};`
            +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};\r\n`;
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
        .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
        .replace('##city##', city)
        .replace('##titleCurse##', config.titleCurse)
        .replace('##titleRejected##', config.titleRejected)
        .replace('##textGSTypeGeneral##', config.textGSTypeGeneral)
        .replace('##titleWarning##', config.titleWarning)
      }  

      htmlListaExcluidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
      htmlListaExcluidos += `	  <td>${orden}</td>`;
      htmlListaExcluidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${generarTextoExclusionGS(ap.incumple)}</td>`;
      htmlListaExcluidos += `  </tr>`;
      contentExcluidosExcel+= `${(orden || '')};${ap.docId ? `${ap.docId}` : 'Ninguno'};${ap.personalId};${ap.incumple};${generarTextoExclusionGS(ap.incumple)}\r\n`;
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
