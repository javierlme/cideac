const xlsx = require('xlsx');
const path = require('path');
const courseService = require('../routers/courses');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');



const sortLeyendas = (c1, c2) => {
  return (Number(c1.codigoCentro) != Number(c2.codigoCentro))? Number(c2.codigoCentro) - Number(c1.codigoCentro) :
    (Number(c1.codigoCurso) != Number(c2.codigoCurso))? Number(c2.codigoCurso) - Number(c1.codigoCurso) :  
      (Number(c1.numeroCurso) != Number(c2.numeroCurso))? Number(c1.numeroCurso) - Number(c2.numeroCurso) :  
        String(c1.abreviaturaModulo).localeCompare(String(c2.abreviaturaModulo));
}

const buildPdf = async (city, category, config) => {
  try{
    const listaCentrosCiclosModulosGrouped = await (await courseService.getCategoryCourses(city, category)).sort(sortLeyendas).reduce(function (r, a) {
      const key = String(a.codigoCentro+"#"+a.codigoCurso);
      r[key] = r[key] || [];
      r[key].push(a);
      return r;
  }, Object.create(null));

    const filename = `${category}_Leyenda.pdf`;
    const contentHeaderFile = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'headerBase.html'));
    const leyendaBaseHtml = await fs.readFileSync(path.join(__dirname, '..', 'templates', 'leyendaBase.html'));
  
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
            .replace('##textGBTitleGeneral##', category.toLocaleUpperCase()=='GMD'?config.textGMTitleGeneral:category.toLocaleUpperCase()=='GSD'?config.textGSTitleGeneral:category.toUppercase()=='CED'?config.textCETitleGeneral:'')
            .replace('##city##', city)
            .replace('##titleSlot##', config.titleSlot)
            .replace('##school##', ccm.centro)
            .replace('##course##', ccm.curso)
          }  
          htmlListaLeyendas += `  <tr style="background-color:${(orden++)%1==0?'#aaa':'#fff'};font-weight:normal">`;
          htmlListaLeyendas += `   <td class="width:15%;text-align:left;">${(ccm.abreviaturaModulo)}</td>`;
          htmlListaLeyendas += `   <td class="width:40%;text-align:left;">${(ccm.modulo)}</td>`;
          htmlListaLeyendas += `   <td class="width:15%;text-align:left;">${(ccm.maxHorasModulo)}</td>`;
          htmlListaLeyendas += `   <td class="width:15%;text-align:left;">${(ccm.vacantes)}</td>`;
          htmlListaLeyendas += `	 <td class="width:15%;text-align:left;">${Number(ccm.numeroCurso==1)? 'Primero': Number(ccm.numeroCurso==2)? 'Segundo' : ''}</td>`;
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
        fs.writeFileSync(path.join(__dirname, '..', 'temp', filename), contentLeyendasPdf);
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

module.exports = { buildPdf };
