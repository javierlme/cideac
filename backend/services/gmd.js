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

  const generarTextoExclusionGM = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo+=config.textGMR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo+=config.textGMR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo+=config.textGMR3 + ' / ';
    return motivo.slice(0,-2)
  }

  const generarTextoModulo = (codigoModulo) => {
    const found = listaCentrosCiclosModulos.find(lccm=>String(lccm.codigoModulo)==String(codigoModulo));
    return found? found.abreviaturaModulo : codigoModulo;
  }

  let rowIndex = 2;
  let infoSolicitud;
  const validateAndAppendCourse = (field, mod1, mod2, mod3, mod4, mod5, mod6, mod7, mod8, mod9, mod10, infoSolicitud, prioridad, mandatory = false) => {
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
          cursoCompleto: cursoCompleto
        }
        infoSolicitud.listaCentrosCiclosModulos.push(centrosCiclosModulo);
      }
    }
  }

  // Leer del excel los datos de las listaSolicitudesAceptadas
  while (readCell('A', rowIndex) != '') {
    infoSolicitud = {
      docId: readCell('A', rowIndex),
      applicationId: readCell('B', rowIndex),
      randomNumber: Number(readCell('C', rowIndex).replace(',','.')),
      personalId: readCell('D', rowIndex),
      especialNeeds: false,
      listaCentrosCiclosModulos: Array()
    };  
    validateAndAppendCourse('I', 'K',  'L',  'M',  'N',  'O',  'P',  'Q',  'R',  'S',  'T',  infoSolicitud, ['si','sí'].includes(readCell('U',  rowIndex).toLowerCase()));
    validateAndAppendCourse('W', 'Y',  'Z',  'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', infoSolicitud, ['si','sí'].includes(readCell('AI', rowIndex).toLowerCase()));
    validateAndAppendCourse('AK','AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', infoSolicitud, ['si','sí'].includes(readCell('AW', rowIndex).toLowerCase()));
    validateAndAppendCourse('AY','BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', infoSolicitud, ['si','sí'].includes(readCell('BK', rowIndex).toLowerCase()));
    infoSolicitud.viaAcceso = readCell('H', rowIndex);
    infoSolicitud.scoring = Number(readCell('BM', rowIndex).replace(',','.')) + Number(readCell('BN', rowIndex).split(' ')[0].replace(',','.'));
    infoSolicitud.scoringTotal = Number(readCell('BO', rowIndex).replace(',','.'));   
    console.log(`${infoSolicitud.scoring} vs ${infoSolicitud.scoringTotal}`);
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


  // Tratar asignaciones por prioridades
  var listaAsignadosTotal = Array();
  var lista = Array();
  var listaAsignadosDiscapacitadosTotal = Array(listaCentrosCiclosModulos.length);
  var listaAsignadosDeportistasEliteTotal = Array(listaCentrosCiclosModulos.length);
  var listaAsignadosATotal = Array(listaCentrosCiclosModulos.length);
  var listaAsignadosBTotal = Array(listaCentrosCiclosModulos.length);
  var listaAsignadosCTotal = Array(listaCentrosCiclosModulos.length);
  for (var i=0; i<listaCentrosCiclosModulos.length; i++) {
    listaAsignadosDiscapacitadosTotal[i] = Array();
    listaAsignadosDeportistasEliteTotal[i] = Array();
    listaAsignadosATotal[i] = Array();
    listaAsignadosBTotal[i] = Array();
    listaAsignadosCTotal[i] = Array();
  }

for (var veces=0; veces<1; veces++) {
  var listaSolicitudesAceptadasCopia = JSON.parse(JSON.stringify(listaSolicitudesAceptadas));
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
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

  for (var prioridad=0; prioridad<4; prioridad++) {
    for (var cursoCentroCicloModulo of listaCentrosCiclosModulos) {
     //var  cursoCentroCicloModulo = listaCentrosCiclosModulos[m];
      const claveCurso = (cursoCentroCicloModulo.codigoCentro || '') + "_" + (cursoCentroCicloModulo.codigoCurso || '') + "_" + (cursoCentroCicloModulo.codigoModulo || '');
      var vacantesDisponibles = cursoCentroCicloModulo.vacantes;
      var listaAsignadosDiscapacitados = Array();
      const vacantesDiscapacitados = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageHandicap * config.numSlotsBySeatHandicap);
      console.log(`vacantesDiscapacitados: ${vacantesDiscapacitados}`);
      if ((vacantesDiscapacitados>0) && (veces==0)){
        // Obtener la lista de discapacitados que correspondan al centro-ciclo-modulo

        const listaApp = listaSolicitudesAceptadasCopia.filter(sol => ( ((sol.listaCentrosCiclosModulos[prioridad]?.codigoCentro || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoCurso || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoModulo || '')).includes(claveCurso)));


        listaAsignadosDiscapacitados = cursoCentroCicloModulo.listaAsignadosDiscapacitados.concat(listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (sol.handicapped)
         && ((sol.listaCentrosCiclosModulos[prioridad]?.codigoCentro || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoCurso || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoModulo || '')).includes(claveCurso)))
          .map(s=>{ s.preferencia =s.listaCentrosCiclosModulos[prioridad].prioridad; return s;})).sort(sortCandidates);//.slice(0,vacantesDiscapacitados);

        const longitud = listaAsignadosDiscapacitados.length;

        if (longitud>2) {
          console.log("parar");
        }
        for (var j=vacantesDiscapacitados; j<longitud; j++){
          const elementoQuitado = listaAsignadosDiscapacitados.pop();
          lista = lista.filter(l=>l!=elementoQuitado.applicationId);
        }
        
        vacantesDisponibles -= listaAsignadosDiscapacitados.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
        if (vacantesDisponibles<0) {
          const vac = vacantesDisponibles*-1
          for (var j =0; j<vac; j++) {
            const elementoQuitado = listaAsignadosDiscapacitados.pop();
            lista = lista.filter(l=>l!=elementoQuitado.applicationId);
            vacantesDisponibles++;
          }
        }
        lista = lista.concat(listaAsignadosDiscapacitados.map(sol=>sol.applicationId));
      }

      var listaAsignadosDeportistasElite = Array();
      const vacantesDeportistasElite = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageAthlete * config.numSlotsBySeatAthlete);
      if ((vacantesDeportistasElite>0) && (vacantesDisponibles>0) && (veces==0)){
        // Obtener la lista de deportista de élite que correspondan al centro-ciclo-modulo
        listaAsignadosDeportistasElite = cursoCentroCicloModulo.listaAsignadosDeportistasElite.concat(listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (sol.eliteAthlete) 
          && ((sol.listaCentrosCiclosModulos[prioridad]?.codigoCentro || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoCurso || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoModulo || '')).includes(claveCurso)))
          .map(s=>{ s.preferencia =s.listaCentrosCiclosModulos[prioridad].prioridad; return s;})).sort(sortCandidates);//.slice(0,vacantesDeportistasElite);

        const longitud = listaAsignadosDeportistasElite.length;
        for (var j=vacantesDeportistasElite; j<longitud; j++){
            const elementoQuitado = listaAsignadosDeportistasElite.pop();
          lista = lista.filter(l=>l!=elementoQuitado.applicationId);
        }
  

        vacantesDisponibles -= listaAsignadosDeportistasElite.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
        if (vacantesDisponibles<0) {
          const vac = vacantesDisponibles*-1
          for (var j =0; j<vac; j++) {
            const elementoQuitado = listaAsignadosDeportistasElite.pop();
            lista = lista.filter(l=>l!=elementoQuitado.applicationId);            
            vacantesDisponibles++;
          }
        }
        lista = lista.concat(listaAsignadosDeportistasElite.map(sol=>sol.applicationId));
      }
      
      const vacantesListaA = Math.round(vacantesDisponibles * config.percentageA);
      const vacantesListaB = Math.round(vacantesDisponibles * config.percentageB);
      const vacantesListaC = Math.round(vacantesDisponibles * config.percentageC);
      console.log(`${veces} -> claveCurso:${claveCurso} vacantesDisponibles:${vacantesDisponibles}  vacantesListaA:${vacantesListaA}  vacantesListaB:${vacantesListaB}`)

      // Lista A

      var listaAsignadosPorPrioridadBolsaA = Array();
      if (vacantesListaA>0){
        // Obtener la lista de solicitantes que correspondan al centro-ciclo-modulo y no están en los grupos anteriores
        listaAsignadosPorPrioridadBolsaA = cursoCentroCicloModulo.listaAsignadosA.concat(listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (String(sol.viaAcceso).toLocaleUpperCase()=='A') 
          && ((sol.listaCentrosCiclosModulos[prioridad]?.codigoCentro || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoCurso || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoModulo || '')).includes(claveCurso)))
          .map(s=>{ s.preferencia =s.listaCentrosCiclosModulos[prioridad].prioridad; return s;})).sort(sortCandidates);

        const longitud = listaAsignadosPorPrioridadBolsaA.length;
        for (var j=vacantesListaA; j<longitud; j++){
          const elementoQuitado = listaAsignadosPorPrioridadBolsaA.pop();
          lista = lista.filter(l=>l!=elementoQuitado.applicationId);
        }
  
        vacantesDisponibles -= listaAsignadosPorPrioridadBolsaA.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
        if (vacantesDisponibles<0) {
          const vac = vacantesDisponibles*-1
          for (var j =0; j<vac; j++) {
            const elementoQuitado = listaAsignadosPorPrioridadBolsaA.pop();
            lista = lista.filter(l=>l!=elementoQuitado.applicationId);
            vacantesDisponibles++;
          }
        }
        lista = lista.concat(listaAsignadosPorPrioridadBolsaA.map(sol=>sol.applicationId));
      }


      // Lista B

      var listaAsignadosPorPrioridadBolsaB = Array();
      if (vacantesListaB>0){
        // Obtener la lista de solicitantes que correspondan al centro-ciclo-modulo y no están en los grupos anteriores
        listaAsignadosPorPrioridadBolsaB = cursoCentroCicloModulo.listaAsignadosB.concat(listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (String(sol.viaAcceso).toLocaleUpperCase()=='B') 
          && ((sol.listaCentrosCiclosModulos[prioridad]?.codigoCentro || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoCurso || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoModulo || '')).includes(claveCurso)))
          .map(s=>{ s.preferencia =s.listaCentrosCiclosModulos[prioridad].prioridad; return s;})).sort(sortCandidates);

        const longitud = listaAsignadosPorPrioridadBolsaB.length;
        for (var j=vacantesListaB; j<longitud; j++){
            const elementoQuitado = listaAsignadosPorPrioridadBolsaB.pop();
          lista = lista.filter(l=>l!=elementoQuitado.applicationId);
        }
  
        vacantesDisponibles -= listaAsignadosPorPrioridadBolsaB.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
        if (vacantesDisponibles<0) {
          const vac = vacantesDisponibles*-1
          for (var j =0; j<vac; j++) {
            const elementoQuitado = listaAsignadosPorPrioridadBolsaB.pop();
            lista = lista.filter(l=>l!=elementoQuitado.applicationId);
            vacantesDisponibles++;
          }
        }
        lista = lista.concat(listaAsignadosPorPrioridadBolsaB.map(sol=>sol.applicationId));
      }
  
      // Lista C

      var listaAsignadosPorPrioridadBolsaC = Array();
      if (vacantesListaC>0){
        // Obtener la lista de solicitantes que correspondan al centro-ciclo-modulo y no están en los grupos anteriores
        listaAsignadosPorPrioridadBolsaC = cursoCentroCicloModulo.listaAsignadosC.concat(listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (String(sol.viaAcceso).toLocaleUpperCase()=='C') 
          && ((sol.listaCentrosCiclosModulos[prioridad]?.codigoCentro || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoCurso || '') + "_" + (sol.listaCentrosCiclosModulos[prioridad]?.codigoModulo || '')).includes(claveCurso)))
          .map(s=>{ s.preferencia =s.listaCentrosCiclosModulos[prioridad].prioridad; return s;})).sort(sortCandidates);

        const longitud = listaAsignadosPorPrioridadBolsaC.length;
        for (var j=vacantesListaC; j<longitud; j++){
            const elementoQuitado = listaAsignadosPorPrioridadBolsaC.pop();
          lista = lista.filter(l=>l!=elementoQuitado.applicationId);
        }
  
        vacantesDisponibles -= listaAsignadosPorPrioridadBolsaC.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
        if (vacantesDisponibles<0) {
          const vac = vacantesDisponibles*-1
          for (var j =0; j<vac; j++) {
            const elementoQuitado = listaAsignadosPorPrioridadBolsaC.pop();
            const count1 = lista.length;
            lista = lista.filter(l=>l!=elementoQuitado.applicationId);
            const count2 = lista.length;
            vacantesDisponibles++;
          }
        }
        lista = lista.concat(listaAsignadosPorPrioridadBolsaC.map(sol=>sol.applicationId));
      }

      cursoCentroCicloModulo.listaAsignadosDiscapacitados = listaAsignadosDiscapacitados.sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = listaAsignadosDeportistasElite.sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosA = listaAsignadosPorPrioridadBolsaA.sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosB = listaAsignadosPorPrioridadBolsaB.sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosC = listaAsignadosPorPrioridadBolsaC.sort(sortCandidates);

      cursoCentroCicloModulo.vacantesDisponibles = vacantesDisponibles;
      console.log(`${veces} - ${prioridad} -> claveCurso:${claveCurso} vacantesDisponibles:${cursoCentroCicloModulo.vacantesDisponibles}`);
    }
  }

// Volver a asignar a las listas A B y C las plazas libres
for (var i=0; i<listaCentrosCiclosModulos.length; i++) {
    const cursoCentroCicloModulo = listaCentrosCiclosModulos[i];

    listaAsignadosDiscapacitadosTotal[i] = listaAsignadosDiscapacitadosTotal[i].concat(cursoCentroCicloModulo.listaAsignadosDiscapacitados);
    listaAsignadosDeportistasEliteTotal[i] = listaAsignadosDeportistasEliteTotal[i].concat(cursoCentroCicloModulo.listaAsignadosDeportistasElite);
    listaAsignadosATotal[i] = listaAsignadosATotal[i].concat(cursoCentroCicloModulo.listaAsignadosA);
    listaAsignadosBTotal[i] = listaAsignadosBTotal[i].concat(cursoCentroCicloModulo.listaAsignadosB);
    listaAsignadosCTotal[i] = listaAsignadosCTotal[i].concat(cursoCentroCicloModulo.listaAsignadosC);
    cursoCentroCicloModulo.vacantes = cursoCentroCicloModulo.vacantesDisponibles;
  }
  console.log("");
}

for (var i=0; i<listaCentrosCiclosModulos.length; i++) {
  const cursoCentroCicloModulo = listaCentrosCiclosModulos[i];
  cursoCentroCicloModulo.listaAsignadosDiscapacitados = listaAsignadosDiscapacitadosTotal[i].sort(sortCandidates);
  cursoCentroCicloModulo.listaAsignadosDeportistasElite = listaAsignadosDeportistasEliteTotal[i].sort(sortCandidates);
  cursoCentroCicloModulo.listaAsignadosA = listaAsignadosATotal[i].sort(sortCandidates);
  cursoCentroCicloModulo.listaAsignadosB = listaAsignadosBTotal[i].sort(sortCandidates);
  cursoCentroCicloModulo.listaAsignadosC = listaAsignadosCTotal[i].sort(sortCandidates);
}


  var listaAsignadosTotal = JSON.parse(JSON.stringify(lista));

  console.log(`listaAsignadosTotal:${listaAsignadosTotal.length}`);
  // Procesar listas de espera

  // Los que no están asignados en ningún sitio
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    const claveCurso = (cursoCentroCicloModulo.codigoCentro || '') + "_" + (cursoCentroCicloModulo.codigoCurso || '') + "_" + (cursoCentroCicloModulo.codigoModulo || '');
    cursoCentroCicloModulo.listaAsignadosAEspera = JSON.parse(JSON.stringify(listaSolicitudesAceptadasCopia.filter(sol => (
      (String(sol.viaAcceso).toLocaleUpperCase()=='A') &&
        ((sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)) &&
          (!listaAsignadosTotal.includes(sol.applicationId)))).map(s=>{ s.preferencia =s.listaCentrosCiclosModulos.find(l=>String ((l.codigoCentro || '') + "_" + (l.codigoCurso || '') + "_" + (l.codigoModulo || ''))==claveCurso).prioridad; return s;}).sort(sortCandidates)));
    cursoCentroCicloModulo.listaAsignadosBEspera = JSON.parse(JSON.stringify(listaSolicitudesAceptadasCopia.filter(sol => (
      (String(sol.viaAcceso).toLocaleUpperCase()=='B') &&
        ((sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)) &&
          (!listaAsignadosTotal.includes(sol.applicationId)))).map(s=>{ s.preferencia =s.listaCentrosCiclosModulos.find(l=>String ((l.codigoCentro || '') + "_" + (l.codigoCurso || '') + "_" + (l.codigoModulo || ''))==claveCurso).prioridad; return s;}).sort(sortCandidates)));
    cursoCentroCicloModulo.listaAsignadosCEspera = JSON.parse(JSON.stringify(listaSolicitudesAceptadasCopia.filter(sol => (
      (String(sol.viaAcceso).toLocaleUpperCase()=='C') &&
        ((sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)) &&
          (!listaAsignadosTotal.includes(sol.applicationId)))).map(s=>{ s.preferencia =s.listaCentrosCiclosModulos.find(l=>String ((l.codigoCentro || '') + "_" + (l.codigoCurso || '') + "_" + (l.codigoModulo || ''))==claveCurso).prioridad; return s;}).sort(sortCandidates)));
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
                ap.preferencia = ap.listaCentrosCiclosModulos[j].prioridad;
                centroEncontrado.listaAsignadosAEspera.push(ap);
                centroEncontrado.listaAsignadosAEspera = centroEncontrado.listaAsignadosAEspera.sort(sortCandidates);
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
                ap.preferencia = ap.listaCentrosCiclosModulos[j].prioridad;
                centroEncontrado.listaAsignadosBEspera.push(ap);
                centroEncontrado.listaAsignadosBEspera = centroEncontrado.listaAsignadosBEspera.sort(sortCandidates);
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
                ap.preferencia = ap.listaCentrosCiclosModulos[j].prioridad;
                centroEncontrado.listaAsignadosCEspera.push(ap);
                centroEncontrado.listaAsignadosCEspera = centroEncontrado.listaAsignadosCEspera.sort(sortCandidates);
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


    // Agrupar Admitidos
    const listaCentrosCiclosModulosAgrupada = Array();
    var listaAsignadosA = Array();
    var listaAsignadosAEspera = Array();
    var listaAsignadosB = Array();
    var listaAsignadosBEspera = Array();
    var listaAsignadosC = Array();
    var listaAsignadosCEspera = Array();
    var listaAsignadosDeportistasElite = Array();
    var listaAsignadosDeportistasEliteEspera = Array();
    var listaAsignadosDiscapacitados = Array();
    var listaAsignadosDiscapacitadosEspera = Array();
  
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
//console.log(`lista.docId: ${lista.docId}`);

        const datosAux = listaAsignadosA.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          //if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
          if (false){
              data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosA.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosAEspera))) {
        const datosAux = listaAsignadosAEspera.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosAEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosB))) {
        const datosAux = listaAsignadosB.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosB.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosBEspera))) {
        const datosAux = listaAsignadosBEspera.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosBEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosC))) {
        const datosAux = listaAsignadosC.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosC.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosCEspera))) {
        const datosAux = listaAsignadosCEspera.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosCEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDeportistasElite))) {
        const datosAux = listaAsignadosDeportistasElite.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosDeportistasElite.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDeportistasEliteEspera))) {
        const datosAux = listaAsignadosDeportistasEliteEspera.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosDeportistasEliteEspera.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDiscapacitados))) {
        const datosAux = listaAsignadosDiscapacitados.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosDiscapacitados.push(data);
        }
      };
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDiscapacitadosEspera))) {
        const datosAux = listaAsignadosDiscapacitadosEspera.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          if (lista.listaCentrosCiclosModulos[0].cursoCompleto){
            data.listaCentrosCiclosModulos.push(lista.listaCentrosCiclosModulos.map(lm=>generarTextoModulo(lm.codigoModulo)));
          }
          else{
            data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo))
          }
          listaAsignadosDiscapacitadosEspera.push(data);
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
          listaAsignadosDeportistasEliteEspera: listaAsignadosDeportistasEliteEspera,
          listaAsignadosDiscapacitados: listaAsignadosDiscapacitados,
          listaAsignadosDiscapacitadosEspera: listaAsignadosDiscapacitadosEspera,
        }
        listaCentrosCiclosModulosAgrupada.push(centroCiclo);
      }
    });

    // Ordenar todas las listas
    for (const cursoCentroCicloModulo of listaCentrosCiclosModulosAgrupada) {
      cursoCentroCicloModulo.listaAsignadosA = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosA)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosAEspera = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosAEspera)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosB = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosB)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosBEspera = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosBEspera)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosC = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosC)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosCEspera = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosCEspera)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosDeportistasElite)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDiscapacitados = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosDiscapacitados)).sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera = JSON.parse(JSON.stringify(cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera)).sort(sortCandidates);
    }

    for (const cursoCentroCicloModulo of listaCentrosCiclosModulosAgrupada) {
      
    // Generar lista admitidos
      
      // Asignados discapacitados
      var orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDiscapacitados.length>0) {
        cursoCentroCicloModulo.listaAsignadosDiscapacitados.map(ap => {
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
            .replace('##titleWarning##', config.titleWarning);
          }  
          htmlListaAdmitidos += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaAdmitidos += `   <td>${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
          htmlListaAdmitidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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

      // Generar lista espera discapacitados
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosDiscapacitadosEspera.map(ap => {
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
            .replace('##textGMTypeGeneral##', config.textGMTypeHandicap)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
      // Generar lista espera deportista élite
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera.map(ap => {
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
            .replace('##textGMTypeGeneral##', config.textGMTypeAthlete)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
      // Generar lista espera resto lista A
      orden=0;
      if (cursoCentroCicloModulo.listaAsignadosAEspera.length>0) {
        cursoCentroCicloModulo.listaAsignadosAEspera.map(ap => {
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
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
          htmlListaEspera += `    <td>${(orden)}</td>`;
          htmlListaEspera += `	  <td>${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
          htmlListaEspera += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td>${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
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
      htmlListaExcluidos += `	  <td>${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td>${generarTextoExclusionGM(ap.incumple)}</td>`;
      htmlListaExcluidos += `  </tr>`;
      contentExcluidosExcel+= `${(orden || '')};${ap.docId ? `${ap.docId}` : 'Ninguno'};${(ap.personalId.substr(ap.personalId.indexOf(', ') + 2) || '')};${ap.incumple};${generarTextoExclusionGM(ap.incumple)}\r\n`;
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
