import { styled } from 'goober';
import { Fragment, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { error, file as fileIcon, signout, trash, expand, colapse, pdf, excel } from '../icons';
import { Redirect } from 'wouter-preact';
import { useSession } from '../stores/session';
import shallow from 'zustand/shallow';
import { API } from '../api';
import {Buffer} from 'buffer';

const selector = (state) => [state.user, state.logout];
const textUploadOk= 'Verificado Correctamente';

const defaultSteps = [
  { id: 'slots', title: 'Subir archivo de plazas', state: 'pending', file: null },
  { id: 'assign', title: 'Subir archivo de solicitudes', state: 'disabled', file: null },
  { id: 'download', title: 'Descargar listados de asignaciones', state: 'disabled', file: null }
];

// Configuration
let openConfig = false;
let randomNumberSelected = 147;
let percentageHandicap = 5;
let numSlotsBySeatHandicap = 1;
let percentageAthlete = 5;
let numSlotsBySeatAthlete = 1;
let percentageA = 60;
let percentageB = 30;
let percentageC = 10;

let titleGeneral = 'PROCESO DE ADMISIÓN DE ESTUDIOS DE FORMACIÓN PROFESIONAL ';
let titleCurse = 'Curso 2022/2023';
let titleAdmitted = 'LISTADO PROVISIONAL DE ADMITIDOS'; // 'LISTADO DEFINITIVO DE ADMITIDOS';
let titleWaiting = 'LISTAS DE ESPERA PROVISIONAL'; // 'LISTAS DE ESPERA DEFINITIVAS';
let titleRejected = 'LISTADO PROVISIONAL DE EXCLUIDOS '; // 'LISTADO DEFINITIVO DE EXCLUIDOS ';
let titleWarning = ' IMPORTANTE: ANTE LOS LISTADOS PROVISIONALES PUBLICADOS EL DÍA 6 DE JULIO, LOS INTERESADOS DISPONDRÁN DE LOS DÍAS 7 Y 8 DE JULIO PARA PRESENTAR RECLAMACIONES A TRAVÉS DE LA SEDE ELECTRÓNICA DEL MEFP.'

let textGBTitleGeneral = 'CICLOS FORMATIVOS DE GRADO BÁSICO';
let textGBTypeGeneral = 'General';
let textGBTypeAthlete = 'Reserva plaza disposición cuarta 1';
let textGBTypeHandicap = 'Reserva plaza disposición cuarta 2';
let textGBR1 = 'Identidad alumno';
let textGBR2 = 'Consejo Orientador firmado';
let textGBR3 = 'Consentimiento';

let textGMTitleGeneral = 'CICLOS FORMATIVOS DE GRADO MEDIO';
let textGMTypeA = 'Título de graduado en ESO';
let textGMTypeB = 'Título de Formación Profesional Básica';
let textGMTypeC = 'Prueba de Acceso / Otras formas de acceso';
let textGMTypeAthlete = 'Reserva plaza disposición cuarta 1';
let textGMTypeHandicap = 'Reserva plaza disposición cuarta 2';
let textGMR1 = 'Identidad alumno';
let textGMR2 = 'Forma de acceso';
let textGMR3 = 'Consentimiento progenitores firmado (menores de edad)';

let textGSTitleGeneral = 'CICLOS FORMATIVOS DE GRADO SUPERIOR';
let textGSTypeA = 'Bachillerato';
let textGSTypeB = 'Título de Técnico (G.M. LOE/LOGSE)';
let textGSTypeC = 'Prueba de Acceso / Otras formas de acceso';
let textGSTypeAthlete = 'Reserva plaza disposición cuarta 1';
let textGSTypeHandicap = 'Reserva plaza disposición cuarta 2';
let textGSR1 = 'Identidad alumno';
let textGSR2 = 'Forma de acceso';
let textGSR3 = 'Consentimiento progenitores firmado (menores de edad)';

let textCETitleGeneral = 'CICLOS FORMATIVOS DE CURSO ESPECIALIZACIÓN';
let textCETypeGeneral = 'General';
let textCETypeAthlete = 'Reserva plaza disposición cuarta 1';
let textCETypeHandicap = 'Reserva plaza disposición cuarta 2';
let textCER1 = 'Identidad alumno';
let textCER2 = 'Forma de acceso';
let textCER3 = 'Consentimiento progenitores firmado (menores de edad)';


export default function Home() {
  const [user, logout] = useSession(selector, shallow);
  const [steps, setSteps] = useState(defaultSteps);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [popupOpen, setPopupOpen] = useState(null);
  const categoryObj = categories.find((c) => c.name === category);
  
  const resetSteps = async (index=0) => {
    for (let i=index; i<steps.length;i++) {
      steps[i] = { ...steps[i], state: i==index?'pending' : 'disabled', file: null };
    }
    updateSteps();
  };
  const updateSteps = async () => {
    const newSteps = [...steps];
    setSteps(newSteps);
  }  

  useEffect(() => {
    if (!user) return;
    API.get('/courses/categories').then(async (res) => {
      const categories = res.data.result;
      setCategories(categories);
      setCategory(categories[0].name);
    });
  }, []);
  useEffect(() => {
    if (categoryObj?.city == null) return;
    API.get('/courses/checkSlots', {
      params: { city: categoryObj.city },
    }).then(async (res) => {
      if (res.data.result) {
        steps[0] = { ...steps[0], state: 'uploaded', file: { name: textUploadOk } };
        resetSteps(1)
      } else {
        resetSteps()
      }
    });
  }, [categoryObj?.city]);

  if (!user) return <Redirect href="/login" />;

  const uploadFile = async (step, file) => {
    const formData = new FormData();
    formData.set('file', file);
    try {
      if (step.id === 'slots') {
        formData.set('city', categoryObj.city);
        const res = await API.post('/courses/slots', formData);
        const index = steps.indexOf(step);
        if (res?.data?.additionalInfo) {
          resetSteps(index);
          steps[index] = { ...steps[index], state: 'error', info: err.data.additionalInfo, file: null };
        }
        else {
          steps[index] = { ...steps[index], state: 'uploaded', file };
          resetSteps(index + 1);
        }
        updateSteps();
      } else if (step.id === 'assign') {
        formData.set('city', categoryObj.city);
        formData.set('category', categoryObj.code);
        formData.set('randomNumberSelected', randomNumberSelected);
        formData.set('percentageHandicap', percentageHandicap);
        formData.set('numSlotsBySeatHandicap', numSlotsBySeatHandicap);
        formData.set('percentageAthlete', percentageAthlete);
        formData.set('numSlotsBySeatAthlete', numSlotsBySeatAthlete);
        formData.set('percentageA', percentageA);
        formData.set('percentageB', percentageB);
        formData.set('percentageC', percentageC);

        formData.set('titleGeneral', titleGeneral);
        formData.set('titleCurse', titleCurse);
        formData.set('titleAdmitted', titleAdmitted);
        formData.set('titleWaiting', titleWaiting);
        formData.set('titleRejected', titleRejected);
        formData.set('titleWarning', titleWarning);

        formData.set('textGBTitleGeneral', textGBTitleGeneral);
        formData.set('textGBTypeGeneral', textGBTypeGeneral);
        formData.set('textGBTypeAthlete', textGBTypeAthlete);
        formData.set('textGBTypeHandicap', textGBTypeHandicap);
        formData.set('textGBR1', textGBR1);
        formData.set('textGBR2', textGBR2);
        formData.set('textGBR3', textGBR3);

        formData.set('textGMTitleGeneral', textGMTitleGeneral);
        formData.set('textGMTypeA', textGMTypeA);
        formData.set('textGMTypeB', textGMTypeB);
        formData.set('textGMTypeC', textGMTypeC);
        formData.set('textGMTypeAthlete', textGMTypeAthlete);
        formData.set('textGMTypeHandicap', textGMTypeHandicap);
        formData.set('textGMR1', textGMR1);
        formData.set('textGMR2', textGMR2);
        formData.set('textGMR3', textGMR3);

        formData.set('textGSTitleGeneral', textGSTitleGeneral);
        formData.set('textGSTypeA', textGSTypeA);
        formData.set('textGSTypeB', textGSTypeB);
        formData.set('textGSTypeC', textGSTypeC);
        formData.set('textGSTypeAthlete', textGSTypeAthlete);
        formData.set('textGSTypeHandicap', textGSTypeHandicap);
        formData.set('textGSR1', textGSR1);
        formData.set('textGSR2', textGSR2);
        formData.set('textGSR3', textGSR3);

        formData.set('textCETitleGeneral', textCETitleGeneral);
        formData.set('textCETypeGeneral', textCETypeGeneral);
        formData.set('textCETypeAthlete', textCETypeAthlete);
        formData.set('textCETypeHandicap', textCETypeHandicap);
        formData.set('textCER1', textCER1);
        formData.set('textCER2', textCER2);
        formData.set('textCER3', textCER3);
        const index = steps.indexOf(step);
        step = steps[index] = { ...steps[index], state: 'waiting', file };
        updateSteps();
        const res = await API.post('/courses/assign', formData);
        if (res.data.url){
          steps[index] = { ...steps[index], state: 'uploaded', file };
          resetSteps(index + 1);
          steps[index+1] = { ...steps[index+1], state: 'ok', filename: res.data.url };
        }
        else{
          resetSteps(index);
          steps[index] = { ...steps[index], state: 'error', info: err.data.additionalInfo, file: null };
        }
        updateSteps();
      }
    } catch (err) {
      const index = steps.indexOf(step);
      resetSteps(index);
      steps[index] = { ...steps[index], state: 'error', info: err?.data?.additionalInfo?err.data.additionalInfo:err, file: null };
      updateSteps();
    }
  };
  const removeFile = async (step) => {
    try {
      if (step.id === 'slots') {
        await API.delete('/courses/slots/'+categoryObj.city);
      }
      resetSteps(steps.indexOf(step));
    } catch (err) {
      const index = steps.indexOf(step);
      resetSteps(index);
      steps[index] = { ...steps[index], state: 'error', info: err.data.additionalInfo, file: null };
      updateSteps();
    }
  };
  const downloadAdmitidosExcel = async (step) => {
    const filename = step.filename + "Admitidos.csv"
    const { data } = await API.get(`/courses/files/excel/${filename}`);
    if (data) {
      let pdfContent = Buffer(data, 'base64');
      const blob = new Blob([pdfContent], { type: 'application/csv;base64' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const downloadAdmitidosPdf = async (step) => {
    const filename = step.filename + "Admitidos.pdf"
    const { data } = await API.get(`/courses/files/pdf/${filename}`);
    if (data) {
      let pdfContent = Buffer(data, 'base64');
      const blob = new Blob([pdfContent], { type: 'application/pdf;base64' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const downloadEsperaExcel = async (step) => {
    const filename = step.filename + "Espera.csv"
    const { data } = await API.get(`/courses/files/excel/${filename}`);
    if (data) {
      let pdfContent = Buffer(data, 'base64');
      const blob = new Blob([pdfContent], { type: 'application/csv;base64' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const downloadEsperaPdf = async (step) => {
    const filename = step.filename + "Espera.pdf"
    const { data } = await API.get(`/courses/files/pdf/${filename}`);
    if (data) {
      let pdfContent = Buffer(data, 'base64');
      const blob = new Blob([pdfContent], { type: 'application/pdf;base64' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const downloadExcluidosExcel = async (step) => {
    const filename = step.filename + "Excluidos.csv"
    const { data } = await API.get(`/courses/files/excel/${filename}`);
    if (data) {
      let pdfContent = Buffer(data, 'base64');
      const blob = new Blob([pdfContent], { type: 'application/csv;base64' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const downloadExcluidosPdf = async (step) => {
    const filename = step.filename + "Excluidos.pdf"
    const { data } = await API.get(`/courses/files/pdf/${filename}`);
    if (data) {
      let pdfContent = Buffer(data, 'base64');
      const blob = new Blob([pdfContent], { type: 'application/pdf;base64' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  return (
    <Container>
      <header>
        <img src="assets/logo.png" alt="" />
        <Button tertiary onClick={logout}>
          <Icon icon={signout} />
          Cerrar sesión
        </Button>
      </header>
      <section className="intro">
        <h2><b>Plataforma de asignación de plazas de formación profesional</b></h2>
        <p>Para comenzar sigue los pasos a continuación:</p>
        <label className="selector">
          Seleccionar ciclo
          <select id="categorySelect" value={category} onChange={(e) => {setCategory(e.target.value); resetSteps(1);}}>
            {categories.map((option) => (
              <option value={option.name} key={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="configParam">
          <h2 style="cursor:pointer" onClick={(e) => 
                { 
                  openConfig = !openConfig;
                  openConfig?document.getElementById('configSectionParamId').style.display='block' : document.getElementById('configSectionParamId').style.display='none';
                  openConfig?document.getElementById('iconConfigSectionParamId1').style.display='none' : document.getElementById('iconConfigSectionParamId1').style.display='block';
                  openConfig?document.getElementById('iconConfigSectionParamId2').style.display='block' : document.getElementById('iconConfigSectionParamId2').style.display='none';
                } 
              }>
            <div id="iconConfigSectionParamId1" style="display:block">
              Parámetros de configuración <Icon icon={expand} />
            </div>
            <div id="iconConfigSectionParamId2" style="display:none">
              Parámetros de configuración <Icon icon={colapse} />
            </div>
          </h2> 
          <div className="divConfig" id="configSectionParamId" style={openConfig?'display:block' : 'display:none'}>

            <h4><b>Desempate</b></h4>
            <table>
              <tr>
                <td class="tdConfig">
                  Número aleatorio asignado
                </td>
                <td>
                  <input class="inputConfig" id="randomNumberSelectedInput" value={randomNumberSelected} onChange={(e) => { randomNumberSelected = e.target.value; resetSteps(); } } />
                </td>
              </tr>
            </table>  
            <h4><b>Minusválidos</b></h4>
            <table>
              <tr>
                <td class="tdConfig">
                  Porcentaje plazas reservadas
                </td>
                <td>
                  <input class="inputConfig" id="percentageHandicapInput" value={percentageHandicap} onChange={(e) => { percentageHandicap = e.target.value; resetSteps(); } } />%
                </td>
              </tr>
            </table>  
            <h4><b>Deportistas élite</b></h4>
            <table>
              <tr>
                <td class="tdConfig">
                  Porcentaje plazas reservadas
                </td>
                <td>
                  <input class="inputConfig" id="percentageAthleteInput" value={percentageAthlete} onChange={(e) => { percentageAthlete = e.target.value; resetSteps(); } } />%
                </td>
              </tr>
            </table>
            <h4><b>Forma acceso</b></h4>
            <table>
            <tr>
                <td class="tdConfig">
                  Porcentaje plazas tipo A
                </td>
                <td>
                  <input class="inputConfig" id="percentageTypeAInput" value={percentageA} onChange={(e) => { percentageA = e.target.value; resetSteps(); } } />%
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Porcentaje plazas tipo B
                </td>
                <td>
                  <input class="inputConfig" id="percentageTypeAInput" value={percentageB} onChange={(e) => { percentageB = e.target.value; resetSteps(); } } />%
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Porcentaje plazas tipo C
                </td>
                <td>
                  <input class="inputConfig" id="percentageTypeAInput" value={percentageC} onChange={(e) => { percentageC = e.target.value; resetSteps(); } } />%
                </td>
              </tr>
            </table>
          </div>
        </section>
        <section className="configText">
          <h2 style="cursor:pointer" onClick={(e) => 
                { 
                  openConfig = !openConfig;
                  openConfig?document.getElementById('configSectionTextId').style.display='block' : document.getElementById('configSectionTextId').style.display='none';
                  openConfig?document.getElementById('iconConfigSectionTextId1').style.display='none' : document.getElementById('iconConfigSectionTextId1').style.display='block';
                  openConfig?document.getElementById('iconConfigSectionTextId2').style.display='block' : document.getElementById('iconConfigSectionTextId2').style.display='none';
                } 
              }>
            <div id="iconConfigSectionTextId1" style="display:block">
              Textos de configuración <Icon icon={expand} />
            </div>
            <div id="iconConfigSectionTextId2" style="display:none">
              Textos de configuración <Icon icon={colapse} />
            </div>
          </h2> 
          <div className="divConfig" id="configSectionTextId" style={openConfig?'display:block' : 'display:none'}>
          <h4><b>Curso</b></h4>
            <table>
            <tr>
                <td class="tdConfig">
                  Título general
                </td>
                <td>
                  <input class="inputConfig" id="titleGeneralInput" value={titleGeneral} onChange={(e) => { titleGeneral = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Título curso
                </td>
                <td>
                  <input class="inputConfig" id="titleCurseInput" value={titleCurse} onChange={(e) => { titleCurse = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Título listado de admitidos
                </td>
                <td>
                  <input class="inputConfig" id="titleAdmittedInput" value={titleAdmitted} onChange={(e) => { titleAdmitted = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Título del listado de espera
                </td>
                <td>
                  <input class="inputConfig" id="titleWaitingInput" value={titleWaiting} onChange={(e) => { titleWaiting = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Título del listado de excluidos
                </td>
                <td>
                  <input class="inputConfig" id="titleRejectedInput" value={titleRejected} onChange={(e) => { titleRejected = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto de Aviso
                </td>
                <td>
                  <input class="inputConfig" id="titleWarningInput" value={titleWarning} onChange={(e) => { titleWarning = e.target.value; resetSteps(); } } />
                </td>
              </tr>
            </table>
            <h4><b>Vía acceso Grado Básico (GB)</b></h4>
            <table>
              <tr>
                <td class="tdConfig">
                  Texto título
                </td>
                <td>
                  <input class="inputConfig" id="textGBTitleGeneralInput" value={textGBTitleGeneral} onChange={(e) => { textGBTitleGeneral = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto vía acceso general
                </td>
                <td>
                  <input class="inputConfig" id="textGBTypeGeneralInput" value={textGBTypeGeneral} onChange={(e) => { textGBTypeGeneral = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso deportista élite
                </td>
                <td>
                  <input class="inputConfig" id="textGBTypeAthleteInput" value={textGBTypeAthlete} onChange={(e) => { textGBTypeAthlete = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso minusvalía
                </td>
                <td>
                  <input class="inputConfig" id="textGBTypeHandicapInput" value={textGBTypeHandicap} onChange={(e) => { textGBTypeHandicap = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R1
                </td>
                <td>
                  <input class="inputConfig" id="textGBR1Input" value={textGBR1} onChange={(e) => { textGBR1 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R2
                </td>
                <td>
                  <input class="inputConfig" id="textGBR2Input" value={textGBR2} onChange={(e) => { textGBR2 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R3
                </td>
                <td>
                  <input class="inputConfig" id="textGBR3Input" value={textGBR3} onChange={(e) => { textGBR3 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
            </table>
            <h4><b>Vía acceso Grado Médio (GM)</b></h4>
            <table>
              <tr>
                <td class="tdConfig">
                  Texto título
                </td>
                <td>
                  <input class="inputConfig" id="textGMTitleGeneralInput" value={textGMTitleGeneral} onChange={(e) => { textGMTitleGeneral = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso tipo A
                </td>
                <td>
                  <input class="inputConfig" id="textGMTypeAInput" value={textGMTypeA} onChange={(e) => { textGMTypeA = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso tipo B
                </td>
                <td>
                  <input class="inputConfig" id="textGMTypeBInput" value={textGMTypeB} onChange={(e) => { textGMTypeB = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso tipo C
                </td>
                <td>
                  <input class="inputConfig" id="textGMTypeCInput" value={textGMTypeC} onChange={(e) => { textGMTypeC = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso deportista élite
                </td>
                <td>
                  <input class="inputConfig" id="textGMTypeAthleteInput" value={textGMTypeAthlete} onChange={(e) => { textGMTypeAthlete = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso minusvalía
                </td>
                <td>
                  <input class="inputConfig" id="textGMTypeHandicapInput" value={textGMTypeHandicap} onChange={(e) => { textGMTypeHandicap = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R1
                </td>
                <td>
                  <input class="inputConfig" id="textGMR1Input" value={textGMR1} onChange={(e) => { textGMR1 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R2
                </td>
                <td>
                  <input class="inputConfig" id="textGMR2Input" value={textGMR2} onChange={(e) => { textGMR2 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R3
                </td>
                <td>
                  <input class="inputConfig" id="textGMR3Input" value={textGMR3} onChange={(e) => { textGMR3 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
            </table>
            <h4><b>Vía acceso Grado Superior (GS)</b></h4>
            <table>
              <tr>
                <td class="tdConfig">
                  Texto título
                </td>
                <td>
                  <input class="inputConfig" id="textGSTitleGeneralInput" value={textGSTitleGeneral} onChange={(e) => { textGSTitleGeneral = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso tipo A
                </td>
                <td>
                  <input class="inputConfig" id="textGSTypeAInput" value={textGSTypeA} onChange={(e) => { textGSTypeA = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso tipo B
                </td>
                <td>
                  <input class="inputConfig" id="textGSTypeBInput" value={textGSTypeB} onChange={(e) => { textGSTypeB = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso tipo C
                </td>
                <td>
                  <input class="inputConfig" id="textGSTypeCInput" value={textGSTypeC} onChange={(e) => { textGSTypeC = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso deportista élite
                </td>
                <td>
                  <input class="inputConfig" id="textGSTypeAthleteInput" value={textGSTypeAthlete} onChange={(e) => { textGSTypeAthlete = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso minusvalía
                </td>
                <td>
                  <input class="inputConfig" id="textGMTypeHandicapInput" value={textGMTypeHandicap} onChange={(e) => { textGMTypeHandicap = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R1
                </td>
                <td>
                  <input class="inputConfig" id="textGSR1Input" value={textGSR1} onChange={(e) => { textGSR1 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R2
                </td>
                <td>
                  <input class="inputConfig" id="textGSR2Input" value={textGSR2} onChange={(e) => { textGSR2 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R3
                </td>
                <td>
                  <input class="inputConfig" id="textGSR3Input" value={textGSR3} onChange={(e) => { textGSR3 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
            </table>
            <h4><b>Vía acceso Curso Especialización (CE)</b></h4>
            <table>
              <tr>
                <td class="tdConfig">
                  Texto título
                </td>
                <td>
                  <input class="inputConfig" id="textCETitleGeneralInput" value={textCETitleGeneral} onChange={(e) => { textCETitleGeneral = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto vía acceso general
                </td>
                <td>
                  <input class="inputConfig" id="textCETypeGeneralInput" value={textCETypeGeneral} onChange={(e) => { textCETypeGeneral = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso deportista élite
                </td>
                <td>
                  <input class="inputConfig" id="textCETypeAthleteInput" value={textCETypeAthlete} onChange={(e) => { textCETypeAthlete = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto acceso minusvalía
                </td>
                <td>
                  <input class="inputConfig" id="textCETypeHandicapInput" value={textCETypeHandicap} onChange={(e) => { textCETypeHandicap = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R1
                </td>
                <td>
                  <input class="inputConfig" id="textCER1Input" value={textCER1} onChange={(e) => { textCER1 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R2
                </td>
                <td>
                  <input class="inputConfig" id="textCER2Input" value={textCER2} onChange={(e) => { textCER2 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
              <tr>
                <td class="tdConfig">
                  Texto lista excluidos R3
                </td>
                <td>
                  <input class="inputConfig" id="textCER3Input" value={textCER3} onChange={(e) => { textCER3 = e.target.value; resetSteps(); } } />
                </td>
              </tr>
            </table>
          </div>
        </section>
      <section className="steps">
        {steps.map((step, index) => (
          <Step
            key={step.id}
            step={step}
            index={index}
            onDownloadAdmitidosPdf={downloadAdmitidosPdf}
            onDownloadAdmitidosExcel={downloadAdmitidosExcel}
            onDownloadEsperaPdf={downloadEsperaPdf}
            onDownloadEsperaExcel={downloadEsperaExcel}
            onDownloadExcluidosPdf={downloadExcluidosPdf}
            onDownloadExcluidosExcel={downloadExcluidosExcel}
            onUpload={uploadFile}
            onRemove={removeFile}
            onShowErrors={(step) => setPopupOpen(step)}
          />
        ))}
      </section>
      {popupOpen && (
        <div className="ErrorPopup">onDownloadAdmitidosExcel
          <div className="Content">
            <h2>Errores</h2>
            <div className="errorText">
              {popupOpen.info.desc.split(/\r\n/).map((err) => (
                <div key={err}>
                  <Icon icon={error} />
                  {err}
                </div>
              ))}
            </div>
            <Button primary onClick={() => setPopupOpen(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}

const input = document.createElement('input');
input.type = 'file';
input.accept = '.xls,.xlsx';

function Step(props) {
  const { step, index, onUpload, onDownloadAdmitidosExcel, onDownloadAdmitidosPdf, onDownloadEsperaExcel, onDownloadEsperaPdf
    , onDownloadExcluidosExcel, onDownloadExcluidosPdf, onRemove, onShowErrors } = props;
  const uploadFile = () => {
    input.onchange = () => {
      onUpload(step, input.files[0]);
      input.value = null;
    };
    input.click();
  };
  return (
    <div className="step" key={step.title} state={step.state}>
      <div className="number">{index + 1}</div>
      <div className="title">{step.title}</div>
      <div className="file">
        <div className="FileInput">
        
          {step.id === 'assign' && step.state === 'waiting' && (
            <Fragment><img style="width:100px;" src="assets/waiting.gif" alt="" /><p>Generando ficheros...</p></Fragment>
          )}
          {step.id === 'download' && step.state === 'ok' && (
            <Fragment>
                <table>
                  <tr>
                    <td style="text-align:center;font-weight:bold;">Lista admitidos</td>
                  </tr>
                </table>
                <table>
                  <tr>
                    <td><Button secondary onClick={() => onDownloadAdmitidosPdf(step)}><Icon icon={pdf}/>Pdf&nbsp;&nbsp;&nbsp;&nbsp;</Button></td>
                    <td><Button secondary onClick={() => onDownloadAdmitidosExcel(step)}><Icon icon={excel} />Excel</Button></td>
                  </tr>
                </table>
                <table>
                  <tr>
                    <td style="text-align:center;font-weight:bold;">Lista espera</td>
                  </tr>
                </table>
                <table>
                  <tr>
                    <td><Button secondary onClick={() => onDownloadEsperaPdf(step)}><Icon icon={pdf}/>Pdf&nbsp;&nbsp;&nbsp;&nbsp;</Button></td>
                    <td><Button secondary onClick={() => onDownloadEsperaExcel(step)}><Icon icon={excel} />Excel</Button></td>
                  </tr>
                </table>
                <table>
                  <tr>
                    <td style="text-align:center;font-weight:bold;">Lista excluidos</td>
                  </tr>
                </table>
                <table>
                  <tr>
                    <td><Button secondary onClick={() => onDownloadExcluidosPdf(step)}><Icon icon={pdf}/>Pdf&nbsp;&nbsp;&nbsp;&nbsp;</Button></td>
                    <td><Button secondary onClick={() => onDownloadExcluidosExcel(step)}><Icon icon={excel} />Excel</Button></td>
                  </tr>
                </table>
            </Fragment>
          )}
          {step.id !== 'download' && step.state === 'pending' && (
            <Fragment>
              Arrastrar archivo o elegir archivo de equipo
              <Button primary onClick={uploadFile}>
                Seleccionar archivo...
              </Button>
            </Fragment>
          )}
          {step.id !== 'download' && step.state === 'uploaded' && (
            <Fragment>
              <Icon className="fileIcon" icon={fileIcon} />
              <div className="fileName">{textUploadOk}</div>
              <Button className="removeBtn" tertiary onClick={() => onRemove(step)}>
                <Icon icon={trash} />Eliminar
              </Button>
            </Fragment>
          )}
          {step.id !== 'download' && step.state === 'error' && (
            <Fragment>
              <span>{step.info?step.info.desc:''}</span>
              <Icon className="errorIcon" icon={error} onClick={() => onShowErrors(step)}
              />
              Ha ocurrido un error, vuelve a subir el archivo
              <Button primary onClick={uploadFile}>
                Seleccionar archivo...
              </Button>
            </Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100vh;

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 20px 50px 20px 100px;

    background: var(--color-accent-100);

    .Button {
      color: white;
    }
  }

  .intro {
    padding: 20px 50px 20px 100px;
    color: var(--color-neutral-100);
    h1 {
      font-weight: normal;
      font-size: 32px;
      line-height: 37px;
    }
    .selector {
      display: flex;
      align-items: center;
      gap: 12px;

      .Combo {
        min-width: 200px;
      }
    }
  }
  .configParam {
    background: white;
    padding: 20px 50px 20px 100px;
    border-top: 1px solid var(--color-neutral-80);
    h1 {
      font-weight: normal;
      font-size: 32px;
      line-height: 37px;
    }
    .inputConfig {
      margin-left:20px;
      margin-right:5px;
      text-align: center;
      width: 40px;
    }
    .tdConfig {
      width: 250px;
      padding: 0;
      margin: 0;
    }
  }
  .configText {
    background: white;
    padding: 20px 50px 20px 100px;
    border-top: 1px solid var(--color-neutral-80);
    h1 {
      font-weight: normal;
      font-size: 32px;
      line-height: 37px;
    }
    .inputConfig {
      margin-left:20px;
      margin-right:5px;
      text-align: left;
      width: 600px;
    }
    .tdConfig {
      width: 250px;
      padding: 0;
      margin: 0;
    }
  }
  .steps {
    background: #f9f9f9;
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
    gap: 24px;
    border-top: 1px solid var(--color-neutral-80);
    padding: 20px 50px 20px 100px;
    color: var(--color-neutral-100);

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;

      &[state='disabled'] {
        filter: opacity(0.5) grayscale(2);
        pointer-events: none;

        .number {
          background: transparent;
          border: 1px dashed #0861d4;
          color: #0861d4;
        }
      }
      &[state='pending'] {
        .number {
          background: transparent;
          border: 1px dashed #0861d4;
          color: #0861d4;
        }
      }

      .number {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #0861d4;
        color: white;

        font-weight: bold;
        font-size: 20px;
        line-height: 23px;
        text-align: center;
        margin-bottom: 10px;
      }
      .title {
        font-size: 20px;
        line-height: 23px;
        text-align: center;
        margin-bottom: 25px;
        width: 350px;
      }

      .file {
        background: white;
        border: 1px dashed #8d8d8d;
        box-sizing: border-box;
        border-radius: 5px;
        width: 350px;
        min-height: 250px;

        display: grid;
        place-items: center;
        padding: 24px;

        .fileName {
          font-weight: bold;
          font-size: 13px;
          line-height: 16px;
          text-align: center;
        }

        .fileIcon {
          --icon-size: 55px;
          color: var(--color-accent-80);
          margin-top: 40px;
        }
        .errorIcon {
          --icon-size: 55px;
          color: var(--color-error);
        }
        .removeBtn {
          margin-top: 20px;
        }
      }
    }
  }

  .FileInput {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    text-align: center;
  }

  .ErrorPopup {
    position: fixed;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    background: rgb(0 0 0 / 10%);
    display: grid;
    place-items: center;
    .Content {
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-width: 500px;
      min-height: 300px;
      background: white;
      padding: 24px;
      box-shadow: 0 0 5px 0 rgb(0 0 0 / 10%);
      border-radius: 5px;
      h2 {
        margin: 0;
      }

      .errorText {
        flex: 1;
        max-height: 300px;
        overflow-y: auto;
        padding-right: 20px;

        div {
          display: flex;
          align-items: center;
          gap: 12px;

          .Icon {
            color: var(--color-error);
          }
        }
      }

      .Button {
        margin-top: 12px;
        align-self: center;
        min-width: 150px;
        justify-content: center;
      }
    }
  }
`;
