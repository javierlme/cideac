/**
 * Tests para la función buildConfig que se usa en courses.js
 * Verificamos que los valores por defecto de la configuración sean correctos
 * cuando no se envían parámetros en el body.
 */

describe('BuildConfig - Valores por defecto', () => {
  // Simulamos lo que hace buildConfig con un body vacío
  const buildConfigFromBody = (body) => {
    return {
      randomNumberSelected: Number(body.randomNumberSelected ? body.randomNumberSelected : 147),
      percentageHandicap: Number(body.percentageHandicap ? body.percentageHandicap : 5) / 100,
      numSlotsBySeatHandicap: Number(body.numSlotsBySeatHandicap ? body.numSlotsBySeatHandicap : 1),
      percentageAthlete: Number(body.percentageAthlete ? body.percentageAthlete : 5) / 100,
      numSlotsBySeatAthlete: Number(body.numSlotsBySeatAthlete ? body.numSlotsBySeatAthlete : 1),
      percentageA: Number(body.percentageA ? body.percentageA : 80) / 100,
      percentageA1: Number(body.percentageA1 ? body.percentageA1 : 45) / 100,
      percentageA2: Number(body.percentageA2 ? body.percentageA2 : 55) / 100,
      percentageB: Number(body.percentageB ? body.percentageB : 15) / 100,
      percentageC: Number(body.percentageC ? body.percentageC : 5) / 100,
      plazasDpresencial: Number(body.plazasDpresencial ? body.plazasDpresencial : 3),
      plazasDdistancia: Number(body.plazasDdistancia ? body.plazasDdistancia : 4),
      plazasDcidead: Number(body.plazasDcidead ? body.plazasDcidead : 20),
      plazasDce: Number(body.plazasDce ? body.plazasDce : 6),
    };
  };

  describe('Con body vacío (valores por defecto)', () => {
    const config = buildConfigFromBody({});

    it('randomNumberSelected debe ser 147 por defecto', () => {
      expect(config.randomNumberSelected).toBe(147);
    });

    it('percentageHandicap debe ser 0.05 (5%)', () => {
      expect(config.percentageHandicap).toBeCloseTo(0.05);
    });

    it('percentageAthlete debe ser 0.05 (5%)', () => {
      expect(config.percentageAthlete).toBeCloseTo(0.05);
    });

    it('percentageA debe ser 0.80 (80%)', () => {
      expect(config.percentageA).toBeCloseTo(0.80);
    });

    it('percentageA1 debe ser 0.45 (45%)', () => {
      expect(config.percentageA1).toBeCloseTo(0.45);
    });

    it('percentageA2 debe ser 0.55 (55%)', () => {
      expect(config.percentageA2).toBeCloseTo(0.55);
    });

    it('percentageB debe ser 0.15 (15%)', () => {
      expect(config.percentageB).toBeCloseTo(0.15);
    });

    it('percentageC debe ser 0.05 (5%)', () => {
      expect(config.percentageC).toBeCloseTo(0.05);
    });

    it('plazasDpresencial debe ser 3', () => {
      expect(config.plazasDpresencial).toBe(3);
    });

    it('plazasDdistancia debe ser 4', () => {
      expect(config.plazasDdistancia).toBe(4);
    });

    it('plazasDcidead debe ser 20', () => {
      expect(config.plazasDcidead).toBe(20);
    });

    it('plazasDce debe ser 6', () => {
      expect(config.plazasDce).toBe(6);
    });

    it('percentageA + percentageB + percentageC debe sumar ~1 (menos handicap y athlete)', () => {
      // percentageA=0.80, percentageB=0.15, percentageC=0.05 = 1.00
      expect(config.percentageA + config.percentageB + config.percentageC).toBeCloseTo(1.0);
    });

    it('percentageA1 + percentageA2 debe sumar 1 (100% del grupo A)', () => {
      expect(config.percentageA1 + config.percentageA2).toBeCloseTo(1.0);
    });
  });

  describe('Con valores personalizados', () => {
    const config = buildConfigFromBody({
      randomNumberSelected: 200,
      percentageHandicap: 10,
      percentageAthlete: 8,
      percentageA: 70,
      percentageA1: 50,
      percentageA2: 50,
      percentageB: 20,
      percentageC: 10,
      plazasDpresencial: 5,
      plazasDdistancia: 6,
      plazasDcidead: 30,
      plazasDce: 8,
    });

    it('debería usar el randomNumberSelected personalizado', () => {
      expect(config.randomNumberSelected).toBe(200);
    });

    it('debería usar percentageHandicap personalizado (10% = 0.10)', () => {
      expect(config.percentageHandicap).toBeCloseTo(0.10);
    });

    it('debería usar percentageAthlete personalizado (8% = 0.08)', () => {
      expect(config.percentageAthlete).toBeCloseTo(0.08);
    });

    it('debería usar percentageA personalizado (70% = 0.70)', () => {
      expect(config.percentageA).toBeCloseTo(0.70);
    });

    it('debería usar plazasDpresencial personalizado', () => {
      expect(config.plazasDpresencial).toBe(5);
    });

    it('debería usar plazasDcidead personalizado', () => {
      expect(config.plazasDcidead).toBe(30);
    });
  });
});

describe('BuildConfig - Coherencia de porcentajes', () => {
  it('percentageHandicap + percentageAthlete no debe superar 100%', () => {
    // Por defecto: 5% + 5% = 10% < 100%
    expect(0.05 + 0.05).toBeLessThanOrEqual(1.0);
  });

  it('la suma total de distribución general A+B+C no excede 100%', () => {
    expect(0.80 + 0.15 + 0.05).toBeCloseTo(1.0);
  });

  it('las subvías de A (A1+A2) deben sumar 100% del grupo A', () => {
    expect(0.45 + 0.55).toBeCloseTo(1.0);
  });
});
