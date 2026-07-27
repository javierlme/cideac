/**
 * @file constants.js
 * @description Constantes globales del sistema de asignación de plazas de FP.
 *
 * - types:      Tipos de ciclo formativo (GB, GBNEE, GM, GS, CE).
 * - cities:     Ciudades gestionadas (Ceuta, Melilla, CIDEAD).
 * - categories: Catálogo completo de convocatorias, donde cada entrada combina
 *               ciudad + tipo + modalidad (presencial P / distancia D).
 *
 * Códigos de categoría:
 *   GB    = Grado Básico (presencial)
 *   GBNEE = Grado Básico con Necesidades Educativas Especiales (presencial)
 *   GMP   = Grado Medio Presencial
 *   GMD   = Grado Medio a Distancia
 *   GSP   = Grado Superior Presencial
 *   GSD   = Grado Superior a Distancia
 *   CEP   = Curso de Especialización Presencial
 *   CED   = Curso de Especialización a Distancia
 */
module.exports = {
  /** Tipos de ciclo soportados por el sistema */
  types: ['GB', 'GBNEE', 'GM', 'GS', 'CE'],
  /** Ciudades / ámbitos territoriales gestionados */
  cities: ['Ceuta', 'Melilla', 'CIDEAD'],
  /**
   * Catálogo de categorías (convocatorias).
   * Cada entrada define: name (etiqueta), code (código interno),
   * city (ciudad) y type (tipo de ciclo al que pertenece).
   */
  categories: [
    /*{ name: 'Ceuta GB',    code: 'GB',  city: 'Ceuta',   type: 'GB' },
    { name: 'Ceuta GB (NEE)', code: 'GBNEE',  city: 'Ceuta', type: 'GB' },
    { name: 'Ceuta GMP',   code: 'GMP', city: 'Ceuta',   type: 'GM' },
    { name: 'Ceuta GMD',   code: 'GMD', city: 'Ceuta',   type: 'GM' },
    { name: 'Ceuta GSP',   code: 'GSP', city: 'Ceuta',   type: 'GS' },
    { name: 'Ceuta GSD',   code: 'GSD', city: 'Ceuta',   type: 'GS' },
    { name: 'Ceuta CEP',   code: 'CEP', city: 'Ceuta',   type: 'CE' },
    { name: 'Melilla GB',  code: 'GB',  city: 'Melilla', type: 'GB' },
    { name: 'Melilla GB (NEE)',  code: 'GBNEE',  city: 'Melilla', type: 'GB' },
    { name: 'Melilla GMP', code: 'GMP', city: 'Melilla', type: 'GM' },
    { name: 'Melilla GMD', code: 'GMD', city: 'Melilla', type: 'GM' },
    { name: 'Melilla GSP', code: 'GSP', city: 'Melilla', type: 'GS' },
    { name: 'Melilla GSD', code: 'GSD', city: 'Melilla', type: 'GS' },
    { name: 'Melilla CEP', code: 'CEP', city: 'Melilla', type: 'CE' },
    { name: 'CIDEAD GMD',  code: 'GMD', city: 'CIDEAD',  type: 'GM' },
    { name: 'CIDEAD GSD',  code: 'GSD', city: 'CIDEAD',  type: 'GS' },*/
    //{ name: 'CIDEAD CEP',  code: 'CEP', city: 'CIDEAD',  type: 'CE' },
    { name: 'CIDEAD CED',  code: 'CED', city: 'CIDEAD',  type: 'CE' }
  ]
};
