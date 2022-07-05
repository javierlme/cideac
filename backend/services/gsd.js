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
  const validateAndAppendCourse = (field, mod1, mod2, mod3, mod4, mod5, mod6, mod7, mod8, mod9, mod10, infoSolicitud, prioridad, mandatory = false) => {
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
          prioridad: prioridad
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
    validateAndAppendCourse('I', 'K',  'L',  'M',  'N',  'O',  'P',  'Q',  'R',  'S',  'T',  infoSolicitud, ['si','sí'].includes(readCell('U',  rowIndex).toLowerCase()), true);
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
  var listaAsignadosDiscapacitados = Array();
  for (const cursoCentroCicloModulo of listaCentrosCiclosModulos) {
    var listaSolicitudesAceptadasCopia = JSON.parse(JSON.stringify(listaSolicitudesAceptadas));
    var lista = Array();
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
    const claveCurso = (cursoCentroCicloModulo.codigoCentro || '') + "_" + (cursoCentroCicloModulo.codigoCurso || '') + "_" + (cursoCentroCicloModulo.codigoModulo || '');

    var vacantesDisponibles = cursoCentroCicloModulo.vacantes;

    const vacantesDiscapacitados = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageHandicap * config.numSlotsBySeatHandicap);
    if (vacantesDiscapacitados>0){
      // Obtener la lista de discapacitados que correspondan al centro-ciclo-modulo
      listaAsignadosDiscapacitados = listaSolicitudesAceptadasCopia.filter(sol => ((sol.handicapped) 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)))
        .map(s=>{ 
          const found = s.listaCentrosCiclosModulos.find(lc=>String((lc.codigoCentro || '') + "_" + (lc.codigoCurso || '') + "_" + (lc.codigoModulo || ''))==claveCurso);
          s.preferencia = found?.prioridad?found.prioridad : false;
          return s;
        })
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
        .map(s=>{
          const found = s.listaCentrosCiclosModulos.find(lc=>String((lc.codigoCentro || '') + "_" + (lc.codigoCurso || '') + "_" + (lc.codigoModulo || ''))==claveCurso);
          s.preferencia = found?.prioridad?found.prioridad : false;
          return s;
        })
        .sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosDeportistasElite = listaAsignadosDeportistasElite.slice(0,vacantesDeportistasElite);
      //cursoCentroCicloModulo.listaAsignadosDeportistasEliteEspera = listaAsignadosDeportistasElite.slice(vacantesDeportistasElite);
      lista = lista.concat(cursoCentroCicloModulo.listaAsignadosDeportistasElite.map(sol=>sol.applicationId));
      vacantesDisponibles -= cursoCentroCicloModulo.listaAsignadosDeportistasElite.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
    }
    const vacantesListaA = Math.ceil(vacantesDisponibles * config.percentageA);
    const vacantesListaB = Math.ceil(vacantesDisponibles * config.percentageB);
    // Resto solicitantes Lista A
    if ((vacantesListaA>0) && (vacantesDisponibles>0)){
      // Obtener la lista de solicitantes que correspondan al centro-ciclo-modulo y no están en los grupos anteriores
      listaAsignadosA = listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (String(sol.viaAcceso).toLocaleUpperCase()=='A') 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)))
        .map(s=>{ 
          const found = s.listaCentrosCiclosModulos.find(lc=>String((lc.codigoCentro || '') + "_" + (lc.codigoCurso || '') + "_" + (lc.codigoModulo || ''))==claveCurso);
          s.preferencia = found?.prioridad?found.prioridad : false;
          return s;
        })
        .sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosA = listaAsignadosA.slice(0,vacantesListaA);
      cursoCentroCicloModulo.listaAsignadosAEspera = listaAsignadosA.slice(vacantesListaA);
      lista = lista.concat(cursoCentroCicloModulo.listaAsignadosA.map(sol=>sol.applicationId));
      vacantesDisponibles -= cursoCentroCicloModulo.listaAsignadosA.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
    }
    // Resto solicitantes Lista B
    if ((vacantesListaB>0) && (vacantesDisponibles>0)){
      // Obtener la lista de solicitantes que correspondan al centro-ciclo-modulo y no están en los grupos anteriores
      listaAsignadosB = listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (String(sol.viaAcceso).toLocaleUpperCase()=='B') 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)))
        .map(s=>{ 
          const found = s.listaCentrosCiclosModulos.find(lc=>String((lc.codigoCentro || '') + "_" + (lc.codigoCurso || '') + "_" + (lc.codigoModulo || ''))==claveCurso);
          s.preferencia = found?.prioridad?found.prioridad : false;
          if (!found) {
            console.log(s)
          }
          return s;
        })
        .sort(sortCandidates);
      cursoCentroCicloModulo.listaAsignadosB = listaAsignadosB.slice(0,vacantesListaB);
      cursoCentroCicloModulo.listaAsignadosBEspera = listaAsignadosB.slice(vacantesListaB);
      lista = lista.concat(cursoCentroCicloModulo.listaAsignadosB.map(sol=>sol.applicationId));
      vacantesDisponibles -= cursoCentroCicloModulo.listaAsignadosB.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
    }
    // Resto solicitantes Lista C
    //const vacantesListaC = Math.ceil(cursoCentroCicloModulo.vacantes * config.percentageC);
    //if ((vacantesListaC>0) && (vacantesDisponibles>0)){
    if (vacantesDisponibles>0){
        // Obtener la lista de solicitantes que correspondan al centro-ciclo-modulo y no están en los grupos anteriores
      listaAsignadosC = listaSolicitudesAceptadasCopia.filter(sol => ((!lista.includes(sol.applicationId)) && (String(sol.viaAcceso).toLocaleUpperCase()=='C') 
        && (sol.listaCentrosCiclosModulos.map(s=>(s.codigoCentro || '') + "_" + (s.codigoCurso || '') + "_" + (s.codigoModulo || ''))).includes(claveCurso)))
        .map(s=>{ 
          const found = s.listaCentrosCiclosModulos.find(lc=>String((lc.codigoCentro || '') + "_" + (lc.codigoCurso || '') + "_" + (lc.codigoModulo || ''))==claveCurso);
          s.preferencia = found?.prioridad?found.prioridad : false;
          if (!found) {
            console.log(s)
          }
          return s;
        })
        .sort(sortCandidates);
      //cursoCentroCicloModulo.listaAsignadosC = listaAsignadosC.slice(0,vacantesListaC);
      //cursoCentroCicloModulo.listaAsignadosCEspera = listaAsignadosC.slice(vacantesListaC);
      cursoCentroCicloModulo.listaAsignadosC = listaAsignadosC.slice(0,vacantesDisponibles);
      cursoCentroCicloModulo.listaAsignadosCEspera = listaAsignadosC.slice(vacantesDisponibles);
      lista = lista.concat(cursoCentroCicloModulo.listaAsignadosC.map(sol=>sol.applicationId));
      vacantesDisponibles -= cursoCentroCicloModulo.listaAsignadosC.reduce(function(total, sol){ return (total + (sol.especialNeeds?Number(2):Number(1)))}, Number(0));
    }
    cursoCentroCicloModulo.vacantesDisponibles = vacantesDisponibles;
    console.log(`cursoCentroCicloModulo.vacantesDisponibles:${cursoCentroCicloModulo.vacantesDisponibles}`);
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


    // TODO Admitidos
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
        const datosAux = listaAsignadosA.find(l=>l.docId==lista.docId)
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
        const datosAux = listaAsignadosAEspera.find(l=>l.docId==lista.docId)
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
        const datosAux = listaAsignadosB.find(l=>l.docId==lista.docId)
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
        const datosAux = listaAsignadosBEspera.find(l=>l.docId==lista.docId)
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
        const datosAux = listaAsignadosC.find(l=>l.docId==lista.docId)
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
        const datosAux = listaAsignadosCEspera.find(l=>l.docId==lista.docId)
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
        const datosAux = listaAsignadosDeportistasElite.find(l=>l.docId==lista.docId)
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
      for (const lista of JSON.parse(JSON.stringify(lccm.listaAsignadosDeportistasEliteEspera))) {
        const datosAux = listaAsignadosDeportistasEliteEspera.find(l=>l.docId==lista.docId)
        if (datosAux){
          datosAux.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
        }
        else {
          const data = JSON.parse(JSON.stringify(lista));
          data.listaCentrosCiclosModulos = Array();
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
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
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
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
          data.listaCentrosCiclosModulos.push(generarTextoModulo(lccm.codigoModulo));
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
          htmlListaAdmitidos += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
          htmlListaAdmitidos += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
          htmlListaAdmitidos += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
          htmlListaAdmitidos += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
          htmlListaAdmitidos += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaAdmitidos += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeHandicap)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
            .replace('##textGSTitleGeneral##', config.textGSTitleGeneral)
            .replace('##city##', city)
            .replace('##titleCurse##', config.titleCurse)
            .replace('##titleWaiting##', config.titleWaiting)
            .replace('##school##', cursoCentroCicloModulo.centro)
            .replace('##course##', cursoCentroCicloModulo.curso)
            .replace('##modulo##', cursoCentroCicloModulo.modulo)
            .replace('##textGSTypeGeneral##', config.textGSTypeAthlete)
            .replace('##titleWarning##', config.titleWarning)
          }  
          htmlListaEspera += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaEspera += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
          htmlListaEspera += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
          htmlListaEspera += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
          htmlListaEspera += `   <td class="width:10%;text-align:left;">${(orden)}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
          htmlListaEspera += `	  <td class="width:30%;text-align:center;">${ap.listaCentrosCiclosModulos.map(m=>m).join(' ')}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.preferencia? 'SI' : 'NO'}</td>`;
          htmlListaEspera += `	  <td class="width:10%;text-align:center;">${ap.scoring.toFixed(3)}</td>`;
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
      htmlListaExcluidos += `	  <td class="width:15%;text-align:left;">${orden}</td>`;
      htmlListaExcluidos += `	  <td class="width:15%;text-align:center;">${ap.docId ? `****${ap.docId.substr(4)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td class="width:30%;text-align:left;">${ap.personalId ? `${ap.personalId.substr(ap.personalId.indexOf(', ') + 2)}` : 'Ninguno'}</td>`;
      htmlListaExcluidos += `	  <td class="width:40%;text-align:left;">${generarTextoExclusionGS(ap.incumple)}</td>`;
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
