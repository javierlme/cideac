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

  const generarTextoExclusionGM = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo+=config.textGMR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo+=config.textGMR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo+=config.textGMR3 + ' / ';
    if (texto.match(new RegExp('r4', 'i')) != null) motivo+=config.textGMR4 + ' / ';
    return motivo.slice(0,-2)
  }

  const generarTextoModulo = (codigoModulo) => {
    const found = listaCentrosCiclosModulos.find(lccm=>String(lccm.codigoModulo)==String(codigoModulo));
    return found? found.abreviaturaModulo : codigoModulo;
  }

  const obtenerTextoModuloPorAbreviatura = (listaAbreviaturaModulo) => {
    var result = '';
    if (Array.isArray(listaAbreviaturaModulo)){
      for (var i=0; i<10; i++){
        if (listaAbreviaturaModulo[i]){
          const found = listaCentrosCiclosModulos.find(lccm=>String(lccm.abreviaturaModulo)==String(listaAbreviaturaModulo[i]));
          result += found? String(found.codigoCurso+found.codigoModulo+'#Curso '+found.numeroCurso+'-'+found.modulo+'('+found.maxHorasModulo+'h)') : String(listaAbreviaturaModulo[i]);
        }
        result += ';';
      }
    }

    return result;
  }

  const algunModuloPrimero = (listaCentrosCiclosModulos) => {
    if (Array.isArray(listaCentrosCiclosModulos)){
      for (var i=0; i<listaCentrosCiclosModulos.length; i++){
        if (listaCentrosCiclosModulos[i]){
          const found = listaCentrosCiclosModulos[i].filter(l=>Number(l.numeroCurso)==Number(1));
          if (found && found.length>0){
            return true;
          }
        }
      }
    }
    else {
      return true;
    }
    return false;
  }

  let rowIndex = 2;
  let infoSolicitud;
  const validateAndAppendCourse = (field, mod1, mod2, mod3, mod4, mod5, mod6, mod7, mod8, mod9, mod10, infoSolicitud, prioridad, textoCursoCompleto, mandatory = false) => {
    var cursoCompleto = false;
    const curso   = readCell(field, rowIndex).split(' ')[0].trim();
    var listaModulos = Array();
    const modulo1 = readCell(mod1,  rowIndex).split('#')[0].trim();
    const modulo2 = readCell(mod2,  rowIndex).split('#')[0].trim();
    const modulo3 = readCell(mod3,  rowIndex).split('#')[0].trim();
    const modulo4 = readCell(mod4,  rowIndex).split('#')[0].trim();
    const modulo5 = readCell(mod5,  rowIndex).split('#')[0].trim();
    const modulo6 = readCell(mod6,  rowIndex).split('#')[0].trim();
    const modulo7 = readCell(mod7,  rowIndex).split('#')[0].trim();
    const modulo8 = readCell(mod8,  rowIndex).split('#')[0].trim();
    const modulo9 = readCell(mod9,  rowIndex).split('#')[0].trim();
    const modulo10=  readCell(mod10, rowIndex).split('#')[0].trim();
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
          //cursoCompleto: cursoCompleto,
          cursoCompleto: false,
          textoCursoCompleto: textoCursoCompleto,
          numeroCurso: Number(selectedCourse.numeroCurso)
        }
        if (Number(selectedCourse.vacantes>0)){
          listaModulosComprobados.push(centrosCiclosModulo);
        }
        else{
          console.log(`Eliminada peticion ${infoSolicitud.applicationId} porque el curso ${selectedCourse.curso} modulo ${selectedCourse.modulo} no tiene plazas.`);
        }
      }
    }
    infoSolicitud.listaCentrosCiclosModulos.push(listaModulosComprobados)
  }

  // Leer del excel los datos de las listaSolicitudesAceptadas
  while (readCell('A', rowIndex) != '') {
    infoSolicitud = {
      docId: readCell('A', rowIndex),
      applicationId: readCell('B', rowIndex),
      randomNumber: toNumberRandom(readCell('C', rowIndex)),
      personalId: readCell('D', rowIndex),
      especialNeeds: false,
      listaCentrosCiclosModulos: Array()
    };  
    validateAndAppendCourse('I', 'K',  'L',  'M',  'N',  'O',  'P',  'Q',  'R',  'S',  'T',  infoSolicitud, ['si','sí'].includes(readCell('U',  rowIndex).toLowerCase()), readCell('J', rowIndex));
    validateAndAppendCourse('W', 'Y',  'Z',  'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', infoSolicitud, ['si','sí'].includes(readCell('AI', rowIndex).toLowerCase()), readCell('X', rowIndex));
    validateAndAppendCourse('AK','AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', infoSolicitud, ['si','sí'].includes(readCell('AW', rowIndex).toLowerCase()), readCell('AL', rowIndex));
    validateAndAppendCourse('AY','BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', infoSolicitud, ['si','sí'].includes(readCell('BK', rowIndex).toLowerCase()), readCell('AZ', rowIndex));
    infoSolicitud.viaAcceso = readCell('H', rowIndex);
    infoSolicitud.scoring = toNumber(readCell('BO', rowIndex));
    infoSolicitud.handicapped = ['si','sí'].includes(readCell('BQ', rowIndex).toLowerCase());
    infoSolicitud.eliteAthlete =  ['si','sí'].includes(readCell('BR', rowIndex).toLowerCase());
    infoSolicitud.incumple =  readCell('BS', rowIndex).toLowerCase();
    infoSolicitud.permitirSegundo =  ['si','sí'].includes(readCell('BT', rowIndex).toLowerCase())?true:false;
    // Condicion especial de solicitud SOLO de segundo y sin embargo NO se permite segundo
    if ((!infoSolicitud.permitirSegundo) && (!algunModuloPrimero(infoSolicitud.listaCentrosCiclosModulos)) ) {
      infoSolicitud.incumple = 'r4';
    }
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

const SIN_ASIGNAR = Number(0);
const ASIGNAR_MINUSVALIDO = Number(1);
const ASIGNAR_DEPORTISTA = Number(2);
const ASIGNAR_GRUPO_A = Number(3);
const ASIGNAR_GRUPO_B = Number(4);
const ASIGNAR_GRUPO_C = Number(5);
const ASIGNAR_GRUPO_D = Number(6);
var algunaSolicitudCambia = true;



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
    if ((!registro) || (![0,1,2,3].includes(index)) || (!registro.listaCentrosCiclosModulos[index])) return null;
    const listaModulos = Array();
    
    registro.listaCentrosCiclosModulos[index].map(modulo=>{
      if (registro.permitirSegundo || (!registro.permitirSegundo && modulo.numeroCurso==1)){
        
        listaModulos.push( {
          applicationId: registro.applicationId,
          claveCentroCicloModulo: generarClave(modulo),
          asignado: SIN_ASIGNAR,
          prioridadPeticion: index,
          admitido: false,
          espera: true,
          preferencia: modulo.prioridad? modulo.prioridad : false,
          scoring : registro.scoring? Number(registro.scoring) : Number(0),
          viaAcceso: registro.viaAcceso? registro.viaAcceso.toLocaleUpperCase() : '',
          eliteAthlete: registro.eliteAthlete? registro.eliteAthlete : false,
          handicapped: registro.handicapped? registro.handicapped : false,
          especialNeeds: registro.especialNeeds? registro.especialNeeds : false,
          randomNumber: Number(registro.randomNumber),
          docId: registro.docId,
          personalId: registro.personalId,
          centro: modulo.centro || '',
          codigoCentro: modulo.codigoCentro || '',
          curso: modulo.curso || '',
          codigoCurso: modulo.codigoCurso || '',
          modulo: modulo.modulo || '',
          codigoModulo: modulo.codigoModulo || '',
          textoCursoCompleto: modulo.textoCursoCompleto || '',
          cursoCompleto: modulo.cursoCompleto? true:false,
          permitirSegundo: registro.permitirSegundo,
          abreviaturaModulo: generarTextoModulo(modulo.codigoModulo)
        })
      }
      else{
        console.log(`Solicitud restringuido cursos de segundo:  ${registro.applicationId}`)
      }
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


  // Generamos las lista de solicitantes por los 6 grupos (minusvalidos, deportistas, A, B, C y D)
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    cursoCentroCicloModulo.claveCentroCicloModulo = generarClave(cursoCentroCicloModulo);
    cursoCentroCicloModulo.listaAsignadosDiscapacitados = Array();
    cursoCentroCicloModulo.listaAsignadosDeportistasElite = Array();
    cursoCentroCicloModulo.listaAsignadosA = Array();
    cursoCentroCicloModulo.listaAsignadosB = Array();
    cursoCentroCicloModulo.listaAsignadosC = Array();
    cursoCentroCicloModulo.listaAsignadosD = Array();
    cursoCentroCicloModulo.listaAsignadosAEspera = Array();
    cursoCentroCicloModulo.listaAsignadosBEspera = Array();
    cursoCentroCicloModulo.listaAsignadosCEspera = Array();
    cursoCentroCicloModulo.listaAsignadosDEspera = Array();
  }

  const comprobarCandidatos = (vacantes, listaAceptados, solicitud, tipoAsignacion) => {

    var hayCambios = false;
    if ((vacantes<=0) || (!listaAceptados) || (!solicitud) || (!Array.isArray(listaAceptados))){
      return hayCambios;
    }

    // Comprobar que esta solicitud no tenga asignada una petición con menor prioridad
    const asignadoPreviamenteMayorPrioridad = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==solicitud.applicationId && lsam.asignado!=SIN_ASIGNAR 
      && lsam.prioridadPeticion<solicitud.prioridadPeticion && lsam.claveCentroCicloModulo!=solicitud.claveCentroCicloModulo));
    if (asignadoPreviamenteMayorPrioridad && contarLista(asignadoPreviamenteMayorPrioridad)>0){
      //console.log(`asignadoPreviamenteMayorPrioridad : ${JSON.stringify(asignadoPreviamenteMayorPrioridad)}`)
      return hayCambios;
    }

    // Caso básico. Existen vacantes disponibles asignación directa
    if (contarLista(listaAceptados)<vacantes){

      solicitud.asignado = tipoAsignacion;
      // Quitar las que estén asignadas por encima de esta
      listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==solicitud.applicationId && lsam.asignado!=SIN_ASIGNAR 
        && lsam.prioridadPeticion>solicitud.prioridadPeticion && lsam.claveCentroCicloModulo!=solicitud.claveCentroCicloModulo)).map(sol=>sol.asignado=SIN_ASIGNAR);
      hayCambios = true;
    }
    else{
      listaAceptados.push(solicitud)
      const solicitudUltima = listaAceptados.sort(ordenarCandidatos).pop();
      if (solicitudUltima.applicationId!=solicitud.applicationId){
        // Existe mejora
        solicitudUltima.asignado = SIN_ASIGNAR;
        solicitud.asignado = tipoAsignacion;
        // Quitar las que estén asignadas por encima de esta
        listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.applicationId==solicitud.applicationId && lsam.asignado!=SIN_ASIGNAR 
          && lsam.prioridadPeticion>solicitud.prioridadPeticion && lsam.claveCentroCicloModulo!=solicitud.claveCentroCicloModulo)).map(sol=>sol.asignado=SIN_ASIGNAR);
        hayCambios = true;
      }
    }
    return hayCambios;
  }

  const solicitudEnEspera = (solicitud) => {
    var result = true;
    // Buscamos si la solicitud tiene asignaciones
    const solicitudAsignada = listaSolicitudesAceptadasMapeadas.find(lsam=>(lsam.applicationId==solicitud.applicationId && lsam.asignado!=SIN_ASIGNAR));
    if ((solicitudAsignada) && ((solicitud.prioridadPeticion>solicitudAsignada.prioridadPeticion) || (solicitudAsignada.claveCentroCicloModulo==solicitud.claveCentroCicloModulo))){
      result = false;
    }
    return result;
  }


  ////////////////////////////////////////////////////////////////////////////
  // Resolvemos primero las solicitudes de minusválidos y deportistas de élite
  ////////////////////////////////////////////////////////////////////////////
  const MaxVueltas = 50;
  var seguir = true;
  for (var vueltas=0; (vueltas<MaxVueltas && seguir); vueltas++) {    
    seguir = false;
    console.log(`---- Vuelta ${vueltas} ----`);

    for (var opcionSolicitud=0; opcionSolicitud<4; opcionSolicitud++) {
      for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
        const vacantesMinusvalidos = redondear(cursoCentroCicloModulo.vacantes * config.percentageHandicap);
        const vacantesDeportistas = redondear(cursoCentroCicloModulo. vacantes * config.percentageAthlete);
        algunaSolicitudCambia = true;
        while (algunaSolicitudCambia){
          algunaSolicitudCambia = false;
          // Resolvemos Minusválidos
          const listaSolicitantesDiscapacitados = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.handicapped 
            && lsam.prioridadPeticion==opcionSolicitud && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);

          for (solicitud of listaSolicitantesDiscapacitados){            
            const listaAceptadosDiscapacitados = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_MINUSVALIDO && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo));
            algunaSolicitudCambia = algunaSolicitudCambia || comprobarCandidatos(vacantesMinusvalidos, listaAceptadosDiscapacitados, solicitud, ASIGNAR_MINUSVALIDO);
          }
          // Resolvemos Deportistas de élite
          const listaSolicitantesDeportistasElite = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.eliteAthlete 
            && lsam.prioridadPeticion==opcionSolicitud && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);

          for (solicitud of listaSolicitantesDeportistasElite){            
            const listaAceptadosDeportistasElite = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_DEPORTISTA && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo));
            algunaSolicitudCambia = algunaSolicitudCambia || comprobarCandidatos(vacantesDeportistas, listaAceptadosDeportistasElite, solicitud, ASIGNAR_DEPORTISTA);
          }
          if (algunaSolicitudCambia) {
            seguir = true;
          }
        }
      }
    }
  }
    
  ////////////////////////////////////////////////////////////////////////////
  // Resolvemos resto grupos A, B y C
  ////////////////////////////////////////////////////////////////////////////
  seguir = true;
  for (vueltas=0; (vueltas<MaxVueltas && seguir); vueltas++) {
    seguir = false;
    console.log(`---- Vuelta ${vueltas} ----`);

    for (var opcionSolicitud=0; opcionSolicitud<4; opcionSolicitud++) {
      for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {

        let vacantesAsignadas = contarLista(listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado!=SIN_ASIGNAR && lsam.asignado!=ASIGNAR_GRUPO_D && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)));
        const vacantesAsignadasA = contarLista(listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_A && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)));
        const vacantesAsignadasB = contarLista(listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_B && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)));
        const vacantesAsignadasC = contarLista(listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_C && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)));
        const vacantesAsignadasD = contarLista(listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_D && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)));

        let vacantesA = redondear(vacantesAsignadasA + ((cursoCentroCicloModulo.vacantes-vacantesAsignadas) * config.percentageA));
        let vacantesB = redondear(vacantesAsignadasB + ((cursoCentroCicloModulo.vacantes-vacantesAsignadas) * config.percentageB));
        let vacantesC = redondear(vacantesAsignadasC + ((cursoCentroCicloModulo.vacantes-vacantesAsignadas) * config.percentageC));
        let vacantesD = config.plazasDdistancia - vacantesAsignadasD;

/*if (cursoCentroCicloModulo.vacantes>vacantesAsignadas) {
  console.log(`${cursoCentroCicloModulo.codigoModulo} ${cursoCentroCicloModulo.modulo} Vacantes:${cursoCentroCicloModulo.vacantes} Asignadas:${vacantesAsignadas} A:${vacantesAsignadasA} B:${vacantesAsignadasB} C:${vacantesAsignadasC} D:${vacantesAsignadasD} PA:${vacantesA} PB:${vacantesB} PC:${vacantesC} PD:${vacantesD}`);
}
else{
  console.log(`${cursoCentroCicloModulo.codigoModulo} ${cursoCentroCicloModulo.modulo} Vacantes:${cursoCentroCicloModulo.vacantes} Asignadas:${vacantesAsignadas} A:${vacantesAsignadasA} B:${vacantesAsignadasB} C:${vacantesAsignadasC} D:${vacantesAsignadasD} PA:${vacantesA} PB:${vacantesB} PC:${vacantesC} PD:${vacantesD}`);
  console.log('Nos quedamos sin vacantes')
}*/


        algunaSolicitudCambia = true;
        while (algunaSolicitudCambia){
          algunaSolicitudCambia = false;

          // Resolvemos Grupo A
          const listaSolicitantesA = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.viaAcceso=='A'
            && lsam.prioridadPeticion==opcionSolicitud && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);

          for (solicitud of listaSolicitantesA){            
            const listaAceptadosA = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_A && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo));
  
            algunaSolicitudCambia = algunaSolicitudCambia || comprobarCandidatos(vacantesA, listaAceptadosA, solicitud, ASIGNAR_GRUPO_A);
          }

          // Resolvemos Grupo B
          const listaSolicitantesB = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.viaAcceso=='B'
            && lsam.prioridadPeticion==opcionSolicitud && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);

          for (solicitud of listaSolicitantesB){            
            const listaAceptadosB = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_B && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo));
  
            algunaSolicitudCambia = algunaSolicitudCambia || comprobarCandidatos(vacantesB, listaAceptadosB, solicitud, ASIGNAR_GRUPO_B);
          }

          // Resolvemos Grupo C
          const listaSolicitantesC = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.viaAcceso=='C'
            && lsam.prioridadPeticion==opcionSolicitud && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);

          for (solicitud of listaSolicitantesC){            
            const listaAceptadosC = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_C && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo));
  
            algunaSolicitudCambia = algunaSolicitudCambia || comprobarCandidatos(vacantesC, listaAceptadosC, solicitud, ASIGNAR_GRUPO_C);
          }

          // Resolvemos Grupo D
          const listaSolicitantesD = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.viaAcceso=='D'
            && lsam.prioridadPeticion==opcionSolicitud && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);

          for (solicitud of listaSolicitantesD){            
            const listaAceptadosD = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_D && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo));
  
            algunaSolicitudCambia = algunaSolicitudCambia || comprobarCandidatos(vacantesD, listaAceptadosD, solicitud, ASIGNAR_GRUPO_D);
          }

          if (algunaSolicitudCambia) {
            seguir = true;
          }
          else{
            vacantesAsignadas = contarLista(listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado!=SIN_ASIGNAR && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)));
            if (cursoCentroCicloModulo.vacantes>vacantesAsignadas){
              if ((!algunaSolicitudCambia) && (vacantesAsignadasA>=vacantesA)) {
                algunaSolicitudCambia=true;
                seguir = true;
                vacantesA++;
                console.log(`Vuelta:${vueltas} Opcion Solicitud:${opcionSolicitud} Asignar restos para el grupo A. Vacantes:${vacantesA} ${cursoCentroCicloModulo.codigoModulo} ${cursoCentroCicloModulo.modulo} Vacantes:${cursoCentroCicloModulo.vacantes} Asignadas:${vacantesAsignadas} A:${vacantesAsignadasA} B:${vacantesAsignadasB} C:${vacantesAsignadasC} PA:${vacantesA} PB:${vacantesB} PC:${vacantesC}`);
              }
              if ((!algunaSolicitudCambia) && (vacantesAsignadasB>=vacantesB)) {
                algunaSolicitudCambia=true;
                seguir = true;
                vacantesB++;
                console.log(`Vuelta:${vueltas} Opcion Solicitud:${opcionSolicitud} Asignar restos para el grupo B. Vacantes:${vacantesB} ${cursoCentroCicloModulo.codigoModulo} ${cursoCentroCicloModulo.modulo} Vacantes:${cursoCentroCicloModulo.vacantes} Asignadas:${vacantesAsignadas} A:${vacantesAsignadasA} B:${vacantesAsignadasB} C:${vacantesAsignadasC} PA:${vacantesA} PB:${vacantesB} PC:${vacantesC}`);
              }
              if ((!algunaSolicitudCambia) && (vacantesAsignadasC>=vacantesC)) {
                algunaSolicitudCambia=true;
                seguir = true;
                vacantesC++;
                console.log(`Vuelta:${vueltas} Opcion Solicitud:${opcionSolicitud} Asignar restos para el grupo C. Vacantes:${vacantesC} ${cursoCentroCicloModulo.codigoModulo} ${cursoCentroCicloModulo.modulo} Vacantes:${cursoCentroCicloModulo.vacantes} Asignadas:${vacantesAsignadas} A:${vacantesAsignadasA} B:${vacantesAsignadasB} C:${vacantesAsignadasC} PA:${vacantesA} PB:${vacantesB} PC:${vacantesC}`);
              }
            }
          }
        }
      }
    }
  }


  // Rellenar la lista de asignados
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    cursoCentroCicloModulo.listaAsignadosDiscapacitados = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_MINUSVALIDO && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosDeportistasElite = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_DEPORTISTA && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosA = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_A && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosB = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_B && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosC = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_C && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosD = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==ASIGNAR_GRUPO_D && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosAEspera = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo 
      && lsam.viaAcceso=='A')).filter(solicitud=>solicitudEnEspera(solicitud)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosBEspera = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo 
      && lsam.viaAcceso=='B')).filter(solicitud=>solicitudEnEspera(solicitud)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosCEspera = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo 
      && lsam.viaAcceso=='C')).filter(solicitud=>solicitudEnEspera(solicitud)).sort(ordenarCandidatos);
    cursoCentroCicloModulo.listaAsignadosDEspera = listaSolicitudesAceptadasMapeadas.filter(lsam=>(lsam.asignado==SIN_ASIGNAR && lsam.claveCentroCicloModulo==cursoCentroCicloModulo.claveCentroCicloModulo 
      && lsam.viaAcceso=='D')).filter(solicitud=>solicitudEnEspera(solicitud)).sort(ordenarCandidatos);
      
    const asignadosTotales = cursoCentroCicloModulo.listaAsignadosDiscapacitados.length + cursoCentroCicloModulo.listaAsignadosDeportistasElite.length 
      + cursoCentroCicloModulo.listaAsignadosA.length + cursoCentroCicloModulo.listaAsignadosB.length + cursoCentroCicloModulo.listaAsignadosC.length;
    const esperaTotales = cursoCentroCicloModulo.listaAsignadosAEspera.length + cursoCentroCicloModulo.listaAsignadosBEspera.length + cursoCentroCicloModulo.listaAsignadosCEspera.length;
    /*console.log(`---------------------------------------`);      
    console.log(`${cursoCentroCicloModulo.codigoModulo} ${cursoCentroCicloModulo.modulo} Vacantes:${cursoCentroCicloModulo.vacantes}`);
    console.log(`    Asignados: ${asignadosTotales}`);
    console.log(`    Espera: ${esperaTotales}`);*/
    if (((asignadosTotales<cursoCentroCicloModulo.vacantes) && (esperaTotales>0)) || (asignadosTotales>cursoCentroCicloModulo.vacantes)){
      console.log(`----------------ERROR------------------`);
      console.log(`${cursoCentroCicloModulo.codigoModulo} ${cursoCentroCicloModulo.modulo} Vacantes:${cursoCentroCicloModulo.vacantes}`);
      console.log(`    Asignados: ${asignadosTotales} Disc:${cursoCentroCicloModulo.listaAsignadosDiscapacitados.length} Elite:${cursoCentroCicloModulo.listaAsignadosDeportistasElite.length} A:${cursoCentroCicloModulo.listaAsignadosA.length} B:${cursoCentroCicloModulo.listaAsignadosB.length} C:${cursoCentroCicloModulo.listaAsignadosC.length} D:${cursoCentroCicloModulo.listaAsignadosD.length} `);
      console.log(`    Espera: ${esperaTotales}`);
    }
  }
  

  const filename = `${category}_${Date.now()}_`;
  const contentHeaderFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'headerBase.html'));
  const admitidosBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `admitidosBaseC${category}.html`));
  const esperaBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `esperaBaseC${category}.html`));
  const excluidosBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', `excluidosBaseC${category}.html`));

  var contentAdmitidosExcel = 'ORDEN;NÚMERO DOCUMENTO DE IDENTIDAD;NÚMERO SOLICITUD;CENTRO;CÓDIGO CENTRO;CICLO;CÓDIGO CICLO;LISTA;PREFERENCIA;PUNTUACIÓN;MINUSVALÍA;ATLETA;MODULO_1;MODULO_2;MODULO_3;MODULO_4;MODULO_5;MODULO_6;MODULO_7;MODULO_8;MODULO_9;MODULO_10;\r\n';
  var contentEsperaExcel = contentAdmitidosExcel;
  var contentExcluidosExcel = 'NÚMERO;DNI;NOMBRE;CÓDIGO EXCLUSIÓN;MOTIVO EXCLUSIÓN;\r\n';

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
    var listaAsignadosD = Array();
    var listaAsignadosDEspera = Array();
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
        listaAsignadosD = Array();
        listaAsignadosDEspera = Array();
        listaAsignadosDeportistasElite = Array();
        listaAsignadosDeportistasEliteEspera = Array();
        listaAsignadosDiscapacitados = Array();
        listaAsignadosDiscapacitadosEspera = Array();
      }
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosA))) {
        const datosAux = listaAsignadosA.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosA.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosAEspera))) {
        const datosAux = listaAsignadosAEspera.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosAEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosB))) {
        const datosAux = listaAsignadosB.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosB.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosBEspera))) {
        const datosAux = listaAsignadosBEspera.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosBEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosC))) {
        const datosAux = listaAsignadosC.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosC.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosCEspera))) {
        const datosAux = listaAsignadosCEspera.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosCEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosD))) {
        const datosAux = listaAsignadosD.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosD.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDEspera))) {
        const datosAux = listaAsignadosDEspera.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosDEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDeportistasElite))) {
        const datosAux = listaAsignadosDeportistasElite.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
          listaAsignadosDeportistasElite.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDiscapacitados))) {
        const datosAux = listaAsignadosDiscapacitados.find(l=>l.applicationId==lista.applicationId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          datosAux.listaCodigosModulos.push(lccm.codigoModulo);
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
          data.listaCodigosModulos = Array();
          data.listaCodigosModulos.push(lccm.codigoModulo);
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
          listaAsignadosD: listaAsignadosD,
          listaAsignadosDEspera: listaAsignadosDEspera,
          listaAsignadosDeportistasElite: listaAsignadosDeportistasElite,
          listaAsignadosDiscapacitados: listaAsignadosDiscapacitados,
        }
        listaCentrosCiclosModulosAgrupada.push(centroCiclo);
      }
    });

    // Ordenar todas las listas
    for (const cursoCentroCicloModulo of listaCentrosCiclosModulosAgrupada) {
      cursoCentroCicloModulo.listaAsignadosDiscapacitados = cursoCentroCicloModulo.listaAsignadosDiscapacitados.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = cursoCentroCicloModulo.listaAsignadosDeportistasElite.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosA = cursoCentroCicloModulo.listaAsignadosA.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosB = cursoCentroCicloModulo.listaAsignadosB.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosC = cursoCentroCicloModulo.listaAsignadosC.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosD = cursoCentroCicloModulo.listaAsignadosD.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosAEspera = cursoCentroCicloModulo.listaAsignadosAEspera.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosBEspera = cursoCentroCicloModulo.listaAsignadosBEspera.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosCEspera = cursoCentroCicloModulo.listaAsignadosCEspera.sort(ordenarCandidatos);
      cursoCentroCicloModulo.listaAsignadosDEspera = cursoCentroCicloModulo.listaAsignadosDEspera.sort(ordenarCandidatos);
    }

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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeHandicap)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeAthlete)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeA)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeB)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleAdmitted##', config.titleAdmitted)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeC)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaAdmitidos += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaAdmitidos += `  </tr>`;
          contentAdmitidosExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeA)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `   <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaEspera += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaEspera += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeB)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `   <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaEspera += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaEspera += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
            .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGMTypeGeneral##', config.textGMTypeC)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${textoCursoCompletoModulos}</td>`;
          htmlListaEspera += `	  <td>${ap.permitirSegundo? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td>${ap.scoring.toFixed(3)}</td>`;
          htmlListaEspera += `	  <td>${(ap.prioridadPeticion+1)}</td>`;
          htmlListaEspera += `  </tr>`;
          contentEsperaExcel+= `${(orden || '')};${(ap.docId || '')};${(ap.applicationId || '')};${(cursoCentroCicloModulo.centro || '')};`
            +`${(cursoCentroCicloModulo.codigoCentro || '')};${(cursoCentroCicloModulo.curso || '')};${(cursoCentroCicloModulo.codigoCurso || '')};`
              +`${(ap.viaAcceso || '')};${(ap.preferencia? 'SI' : 'NO')};${(ap.scoring || '')};${ap.handicapped ? 'SI' : 'NO'};${ap.eliteAthlete ? 'SI' : 'NO'};`
                +`${(ap.listaCodigosModulos.map(l=>l).join(';') || '')};\r\n`;
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
    listaSolicitudesNoAceptadas.sort(function(a,b){return (String(a.personalId.substr(a.personalId.indexOf(', ') + 2)).localeCompare(String(b.personalId.substr(b.personalId.indexOf(', ') + 2))))}).map(ap => {
      if (orden%numLinesPerPage==0){
        htmlListaExcluidos += excluidosBaseHtml.toString()
        .replace('##titleGeneral##', config.titleGeneral)
        .replace('##textGMTitleGeneral##', config.textGMTitleGeneral)
        .replace('##city##', city)
        .replace('##titleCurse##', config.titleCurse)
        .replace('##titleRejected##', config.titleRejected)
        .replace('##textGMTypeGeneral##', config.textGMTypeGeneral)
        .replace('##titleWarning##', config.titleWarning)
      }  

      htmlListaExcluidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
      htmlListaExcluidos += `	  <td>${orden}</td>`;
      htmlListaExcluidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += ``;//`	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${generarTextoExclusionGM(ap.incumple)}</td>`;
      htmlListaExcluidos += `  </tr>`;
      contentExcluidosExcel+= `${(orden || '')};${ap.docId ? `${ap.docId}` : 'Ninguno'};${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'};${ap.incumple};${generarTextoExclusionGM(ap.incumple)}\r\n`;
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
