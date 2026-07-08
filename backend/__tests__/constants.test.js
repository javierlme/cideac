const constants = require('../constants');

describe('Constants', () => {

  describe('types', () => {
    it('debería contener los tipos de ciclo correctos', () => {
      expect(constants.types).toEqual(['GB', 'GBNEE', 'GM', 'GS', 'CE']);
    });

    it('debería tener exactamente 5 tipos', () => {
      expect(constants.types).toHaveLength(5);
    });
  });

  describe('cities', () => {
    it('debería contener las ciudades correctas', () => {
      expect(constants.cities).toEqual(['Ceuta', 'Melilla', 'CIDEAD']);
    });

    it('debería tener exactamente 3 ciudades', () => {
      expect(constants.cities).toHaveLength(3);
    });
  });

  describe('categories', () => {
    it('debería tener las categorías definidas', () => {
      expect(constants.categories.length).toBeGreaterThan(0);
    });

    it('cada categoría debe tener name, code, city y type', () => {
      constants.categories.forEach(cat => {
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('code');
        expect(cat).toHaveProperty('city');
        expect(cat).toHaveProperty('type');
      });
    });

    it('las ciudades en categorías deben estar en la lista de ciudades', () => {
      constants.categories.forEach(cat => {
        expect(constants.cities).toContain(cat.city);
      });
    });

    it('los tipos en categorías deben ser válidos', () => {
      const validTypes = ['GB', 'GBNEE', 'GM', 'GS', 'CE'];
      constants.categories.forEach(cat => {
        expect(validTypes).toContain(cat.type);
      });
    });

    // Categorías específicas de Ceuta
    it('debería incluir categorías de Ceuta GB', () => {
      const ceutaGB = constants.categories.find(c => c.name === 'Ceuta GB');
      expect(ceutaGB).toBeDefined();
      expect(ceutaGB.code).toBe('GB');
      expect(ceutaGB.city).toBe('Ceuta');
      expect(ceutaGB.type).toBe('GB');
    });

    it('debería incluir categorías de Ceuta GSP', () => {
      const ceutaGSP = constants.categories.find(c => c.name === 'Ceuta GSP');
      expect(ceutaGSP).toBeDefined();
      expect(ceutaGSP.code).toBe('GSP');
      expect(ceutaGSP.city).toBe('Ceuta');
      expect(ceutaGSP.type).toBe('GS');
    });

    // Categorías de Melilla
    it('debería incluir categorías de Melilla GMP', () => {
      const melillaGMP = constants.categories.find(c => c.name === 'Melilla GMP');
      expect(melillaGMP).toBeDefined();
      expect(melillaGMP.code).toBe('GMP');
      expect(melillaGMP.city).toBe('Melilla');
    });

    // Categorías de CIDEAD
    it('debería incluir CIDEAD GMD', () => {
      const cideadGMD = constants.categories.find(c => c.name === 'CIDEAD GMD');
      expect(cideadGMD).toBeDefined();
      expect(cideadGMD.code).toBe('GMD');
      expect(cideadGMD.city).toBe('CIDEAD');
    });

    it('debería incluir CIDEAD GSD', () => {
      const cideadGSD = constants.categories.find(c => c.name === 'CIDEAD GSD');
      expect(cideadGSD).toBeDefined();
      expect(cideadGSD.code).toBe('GSD');
      expect(cideadGSD.city).toBe('CIDEAD');
    });

    it('debería incluir CIDEAD CED', () => {
      const cideadCED = constants.categories.find(c => c.name === 'CIDEAD CED');
      expect(cideadCED).toBeDefined();
      expect(cideadCED.code).toBe('CED');
      expect(cideadCED.city).toBe('CIDEAD');
    });

    // Verificar la cantidad total de categorías
    it('debería tener el número correcto de categorías', () => {
      expect(constants.categories.length).toBe(17);
    });

    it('Ceuta debería tener 7 categorías', () => {
      const ceutaCats = constants.categories.filter(c => c.city === 'Ceuta');
      expect(ceutaCats.length).toBe(7);
    });

    it('Melilla debería tener 7 categorías', () => {
      const melillaCats = constants.categories.filter(c => c.city === 'Melilla');
      expect(melillaCats.length).toBe(7);
    });

    it('CIDEAD debería tener 3 categorías', () => {
      const cideadCats = constants.categories.filter(c => c.city === 'CIDEAD');
      expect(cideadCats.length).toBe(3);
    });
  });
});
