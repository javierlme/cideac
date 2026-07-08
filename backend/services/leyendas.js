/**
 * @file services/leyendas.js
 * @description Servicio para generar los PDFs de leyendas de la oferta formativa.
 * Las leyendas son documentos que detallan los cursos y módulos disponibles para
 * cada categoría (convocatoria) en una ciudad, agrupados por centro educativo.
 * Se generan dos tipos de leyendas: una para modalidad a distancia y otra para presencial.
 */
const xlsx = require('xlsx');
const path = require('path');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

/**
 * @function sortLeyendasDistancia
 * @description Función de comparación para ordenar los cursos de modalidad a distancia
 * en las leyendas. El orden es: por centro (desc), por curso (desc), por número de curso (asc)
 * y finalmente por abreviatura del módulo (alfabético).
 * @param {Object} c1 - Primer curso a comparar.
 * @param {Object} c2 - Segundo curso a comparar.
 * @returns {number} - Resultado de la comparación.
 */
const sortLeyendasDistancia = (c1, c2) => {
  return (Number(c1.codigoCentro) != Number(c2.codigoCentro))? Number(c2.codigoCentro) - Number(c1.codigoCentro) :
    (Number(c1.codigoCurso) != Number(c2.codigoCurso))? Number(c2.codigoCurso) - Number(c1.codigoCurso) :  
      (Number(c1.numeroCurso) != Number(c2.numeroCurso))? Number(c1.numeroCurso) - Number(c2.numeroCurso) :  
        String(c1.abreviaturaModulo).localeCompare(String(c2.abreviaturaModulo));
}

/**
 * @function sortLeyendasPresencial
 * @description Función de comparación para ordenar los cursos de modalidad presencial
 * en las leyendas. El orden es: por centro (desc) y luego por número de vacantes (desc).
 * @param {Object} c1 - Primer curso a comparar.
 * @param {Object} c2 - Segundo curso a comparar.
 * @returns {number} - Resultado de la comparación.
 */
const sortLeyendasPresencial = (c1, c2) => {
  return (Number(c1.codigoCentro) != Number(c2.codigoCentro))? Number(c2.codigoCentro) - Number(c1.codigoCentro) :
    Number(c2.vacantes) - Number(c1.vacantes);
}

/**
 * @function buildPdfDistancia
 * @description Construye y guarda un PDF con la leyenda de la oferta formativa
 * para una categoría de modalidad a distancia.
 * @param {string} city - La ciudad (ej. 'CIDEAD').
 * @param {string} category - La categoría de la convocatoria (ej. 'GMD').
 * @param {Object} config - Objeto de configuración con los textos y títulos para el PDF.
 * @returns {Promise<void>}
 * @throws {Object} - Error si la generación del PDF falla.
 */
const buildPdfDistancia = async (city, category, config) => {
  try{
    const listaCentrosCiclosModulosGrouped = await (await courseService.getCategoryCourses(city, category)).sort(sortLeyendasDistancia).reduce(function (r, a) {
      const key = String(a.codigoCentro+"#"+a.codigoCurso);
      r[key] = r[key] || [];
      r[key].push(a);
      return r;
  }, Object.create(null));

    const filename = `${city}_${category}_Leyenda.pdf`;
    const contentHeaderFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'headerBase.html'));
    const leyendaBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'leyendaDistanciaBase.html'));
  
    if (contentHeaderFile && leyendaBaseHtml){
  
      let htmlListaLeyendas = contentHeaderFile.toString();
      const numLinesPerPage = 50;
      var keys = Object.keys(listaCentrosCiclosModulosGrouped);
      for (const key of keys) {
        const cursoCentroCicloModulo = listaCentrosCiclosModulosGrouped[key];
        var orden=0;
        cursoCentroCicloModulo.map(ccm => {
          if (orden%numLinesPerPage==0){
            htmlListaLeyendas += leyendaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', category.toLocaleUpperCase()=='GMD'?config.textGMTitleGeneral:category.toLocaleUpperCase()=='GSD'?config.textGSTitleGeneral:category.toLocaleUpperCase()=='CED'?config.textCETitleGeneral:'')
            .replace('##city##', city)
            .replace('##titleSlot##', config.titleSlot)
            .replace('##school##', ccm.centro)
            .replace('##course##', ccm.curso)
          }  
          htmlListaLeyendas += `  <tr style="background-color:${(orden++)%1==0?'#888':'#fff'};font-weight:normal;">`;
          htmlListaLeyendas += `   <td>${(ccm.abreviaturaModulo)}</td>`;
          htmlListaLeyendas += `   <td>${(ccm.modulo)}</td>`;
          htmlListaLeyendas += `   <td>${(ccm.maxHorasModulo)}</td>`;
          htmlListaLeyendas += `   <td>${(ccm.vacantes)}</td>`;
          htmlListaLeyendas += `	 <td>${Number(ccm.numeroCurso==1)? 'Primero': Number(ccm.numeroCurso==2)? 'Segundo' : ''}</td>`;
          htmlListaLeyendas += `  </tr>`;
          if (orden%numLinesPerPage==0){
            htmlListaLeyendas += '</table>';
            htmlListaLeyendas += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaLeyendas += `</table>`;
        htmlListaLeyendas += `<div style="page-break-after:always"></div>`;
      }

      const contentLeyendasPdf = await html_to_pdf.generatePdf({ content: htmlListaLeyendas }, 
        { 
            format: 'A4',
            displayHeaderFooter: true,
            footerTemplate: '<style>span{width:100% !important;text-align:center !important;font-size:8px !important;font-family: "Calibri"; }</style><span>Página <label class="pageNumber"></label> de <label class="totalPages"> </label> </span>',
            margin: { top: "0px", bottom: "50px", right: "0px", left: "0px" }
        });
        const filePathName = path.join(__dirname, '..', 'data', filename);
        fs.writeFileSync(filePathName, contentLeyendasPdf);
  }
  }
  catch (error){
    throw {
      httpCode: 400,
      codigoCurso: 'ERR_BUILD_LEYENDS_PDF',
      additionalInfo: {
        desc: `Error del sistema ${error}`
      }
    }
  }

}

/**
 * @function buildPdfPresencial
 * @description Construye y guarda un PDF con la leyenda de la oferta formativa
 * para una categoría de modalidad presencial.
 * @param {string} city - La ciudad (ej. 'Ceuta').
 * @param {string} category - La categoría de la convocatoria (ej. 'GMP').
 * @param {Object} config - Objeto de configuración con los textos y títulos para el PDF.
 * @returns {Promise<void>}
 * @throws {Object} - Error si la generación del PDF falla.
 */
const buildPdfPresencial = async (city, category, config) => {
  try{
    const listaCentrosCiclosModulosGrouped = await (await courseService.getCategoryCourses(city, category)).sort(sortLeyendasPresencial).reduce(function (r, a) {
      const key = String(a.codigoCentro);
      r[key] = r[key] || [];
      r[key].push(a);
      return r;
  }, Object.create(null));

    const filename = `${city}_${category}_Leyenda.pdf`;
    const contentHeaderFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'headerBase.html'));
    const leyendaBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'leyendaPresencialBase.html'));
  
    if (contentHeaderFile && leyendaBaseHtml){

      let htmlListaLeyendas = contentHeaderFile.toString();
      const numLinesPerPage = 50;
      var keys = Object.keys(listaCentrosCiclosModulosGrouped);
      for (const key of keys) {
        const cursoCentroCicloModulo = listaCentrosCiclosModulosGrouped[key];
        var orden=0;
        cursoCentroCicloModulo.map(ccm => {
          if (orden%numLinesPerPage==0){
            htmlListaLeyendas += leyendaBaseHtml.toString()
            .replace('##titleGeneral##', config.titleGeneral)
            .replace('##textGBTitleGeneral##', category.toLocaleUpperCase()=='GB'?config.textGBTitleGeneral:category.toLocaleUpperCase()=='GBNEE'?config.textGBNEETitleGeneral:category.toLocaleUpperCase()=='GMP'?config.textGMTitleGeneral:category.toLocaleUpperCase()=='GSP'?config.textGSTitleGeneral:category.toLocaleUpperCase()=='CEP'?config.textCETitleGeneral:'')
            .replace('##city##', city)
            .replace('##titleSlot##', config.titleSlot)
            .replace('##school##', ccm.centro)
          }  
          htmlListaLeyendas += `  <tr style="background-color:${(orden++)%1==0?'#888':'#fff'};font-weight:normal;">`;
          htmlListaLeyendas += `   <td>${(ccm.curso)}</td>`;
          htmlListaLeyendas += `   <td>${(ccm.vacantes)}</td>`;
          htmlListaLeyendas += `  </tr>`;
          if (orden%numLinesPerPage==0){
            htmlListaLeyendas += '</table>';
            htmlListaLeyendas += `<div style="page-break-after:always"></div>`;
          }
        });
        htmlListaLeyendas += `</table>`;
        htmlListaLeyendas += `<div style="page-break-after:always"></div>`;
      }

      const contentLeyendasPdf = await html_to_pdf.generatePdf({ content: htmlListaLeyendas }, 
        { 
            format: 'A4',
            displayHeaderFooter: true,
            footerTemplate: '<style>span{width:100% !important;text-align:center !important;font-size:8px !important;font-family: "Calibri"; }</style><span>Página <label class="pageNumber"></label> de <label class="totalPages"> </label> </span>',
            margin: { top: "0px", bottom: "50px", right: "0px", left: "0px" }
        });
        const filePathName = path.join(__dirname, '..', 'data', filename);
        fs.writeFileSync(filePathName, contentLeyendasPdf);
  }
  }
  catch (error){
    throw {
      httpCode: 400,
      codigoCurso: 'ERR_BUILD_LEYENDS_PDF',
      additionalInfo: {
        desc: `Error del sistema ${error}`
      }
    }
  }

}

module.exports = { buildPdfDistancia, buildPdfPresencial };
