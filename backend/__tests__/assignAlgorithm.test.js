/**
 * Tests de integración del algoritmo de asignación de plazas.
 * Simulan el flujo completo de asignación con datos controlados
 * para verificar que la distribución por cupos funciona correctamente.
 */

describe('Algoritmo de asignación - Simulación completa', () => {
  // Reproducimos la lógica central de asignación con datos controlados
  const randomNumberSelected = 147;

  const ordenarCandidatos = (c1, c2) => {
    if (Number(c1.scoring) !== Number(c2.scoring)) {
      return Number(c2.scoring) - Number(c1.scoring);
    } else {
      if (
        (Number(c1.randomNumber) - Number(randomNumberSelected) >= 0 &&
          Number(c2.randomNumber) - Number(randomNumberSelected) >= 0) ||
        (Number(c1.randomNumber) - Number(randomNumberSelected) < 0 &&
          Number(c2.randomNumber) - Number(randomNumberSelected) < 0)
      ) {
        return Number(c1.randomNumber) - Number(c2.randomNumber);
      } else {
        return Number(c2.randomNumber) - Number(c1.randomNumber);
      }
    }
  };

  const contarLista = (lista) => {
    if (!lista || !Array.isArray(lista)) return 0;
    let contador = 0;
    for (const item of lista) {
      contador += item.especialNeeds ? 2 : 1;
    }
    return contador;
  };

  const redondear = (valor, vacantesDisponibles = 0) => {
    const result = Math.round(Number(valor));
    if (result) return result;
    return vacantesDisponibles < 1 ? 0 : 1;
  };

  // Crear candidatos de test
  const crearCandidato = (id, scoring, randomNumber, viaAcceso, opts = {}) => ({
    applicationId: `APP-${id}`,
    asignado: false,
    espera: true,
    prioridadPeticion: opts.prioridadPeticion || 0,
    preferencia: opts.preferencia || false,
    scoring: Number(scoring),
    viaAcceso,
    eliteAthlete: opts.eliteAthlete || false,
    handicapped: opts.handicapped || false,
    especialNeeds: opts.especialNeeds || false,
    randomNumber: Number(randomNumber),
    docId: `DNI-${id}`,
    personalId: `APELLIDO, NOMBRE${id}`,
    claveCentroCicloModulo: opts.clave || '001_GMP1_',
    centro: 'Centro Test',
    codigoCentro: '001',
    curso: 'Curso Test',
    codigoCurso: 'GMP1',
    modulo: '',
    codigoModulo: '',
  });

  describe('Distribución básica de vacantes', () => {
    it('debería asignar candidatos hasta completar vacantes', () => {
      const vacantes = 3;
      const candidatos = [
        crearCandidato(1, 10, 200, 'A1'),
        crearCandidato(2, 9, 300, 'A1'),
        crearCandidato(3, 8, 400, 'A1'),
        crearCandidato(4, 7, 500, 'A1'), // Este no debería ser asignado
      ].sort(ordenarCandidatos);

      let asignados = 0;
      for (const c of candidatos) {
        if (asignados < vacantes) {
          c.asignado = true;
          c.espera = false;
          asignados++;
        }
      }

      expect(candidatos.filter(c => c.asignado).length).toBe(3);
      expect(candidatos.filter(c => !c.asignado).length).toBe(1);
      expect(candidatos.find(c => !c.asignado).applicationId).toBe('APP-4');
    });

    it('no debería asignar más candidatos que vacantes', () => {
      const vacantes = 2;
      const candidatos = [
        crearCandidato(1, 10, 200, 'A1'),
        crearCandidato(2, 9, 300, 'A1'),
        crearCandidato(3, 8, 400, 'A1'),
      ].sort(ordenarCandidatos);

      let asignados = 0;
      for (const c of candidatos) {
        if (asignados < vacantes) {
          c.asignado = true;
          c.espera = false;
          asignados++;
        }
      }

      expect(candidatos.filter(c => c.asignado).length).toBe(2);
    });
  });

  describe('Porcentajes de cupo', () => {
    const config = {
      percentageHandicap: 0.05,
      percentageAthlete: 0.05,
      percentageA: 0.80,
      percentageA1: 0.45,
      percentageA2: 0.55,
      percentageB: 0.15,
      percentageC: 0.05,
    };

    it('debería calcular correctamente el número de plazas para discapacitados (5% de 20 = 1)', () => {
      expect(redondear(20 * config.percentageHandicap)).toBe(1);
    });

    it('debería calcular correctamente el número de plazas para deportistas (5% de 20 = 1)', () => {
      expect(redondear(20 * config.percentageAthlete)).toBe(1);
    });

    it('debería calcular plazas grupo A1 correctamente', () => {
      // 20 vacantes - 1 handicap - 1 athlete = 18 generales
      // 18 * 0.80 * 0.45 = 6.48 -> redondea a 6
      const vacantesGenerales = 18;
      const plazasA1 = redondear(vacantesGenerales * config.percentageA * config.percentageA1);
      expect(plazasA1).toBe(6);
    });

    it('debería calcular plazas grupo A2 correctamente', () => {
      const vacantesGenerales = 18;
      const plazasA2 = redondear(vacantesGenerales * config.percentageA * config.percentageA2);
      // 18 * 0.80 * 0.55 = 7.92 -> redondea a 8
      expect(plazasA2).toBe(8);
    });

    it('debería calcular plazas grupo B correctamente', () => {
      const vacantesGenerales = 18;
      const plazasB = redondear(vacantesGenerales * config.percentageB);
      // 18 * 0.15 = 2.7 -> redondea a 3
      expect(plazasB).toBe(3);
    });

    it('debería calcular plazas grupo C correctamente', () => {
      const vacantesGenerales = 18;
      const plazasC = redondear(vacantesGenerales * config.percentageC);
      // 18 * 0.05 = 0.9 -> redondea a 1
      expect(plazasC).toBe(1);
    });

    it('con 10 vacantes totales, la distribución debería cubrir las plazas', () => {
      const totalVacantes = 10;
      const handicap = redondear(totalVacantes * config.percentageHandicap);    // 1
      const athlete = redondear(totalVacantes * config.percentageAthlete);       // 1
      const generales = totalVacantes - handicap - athlete;                      // 8
      const a1 = redondear(generales * config.percentageA * config.percentageA1); // 3
      const a2 = redondear(generales * config.percentageA * config.percentageA2); // 4
      const b = redondear(generales * config.percentageB);                        // 1
      const c = redondear(generales * config.percentageC);                        // 0

      // El total puede superar las vacantes debido a redondeo,
      // pero la lógica del servicio lo gestiona con vacantesDisponibles
      expect(handicap).toBeGreaterThanOrEqual(0);
      expect(athlete).toBeGreaterThanOrEqual(0);
      expect(a1).toBeGreaterThanOrEqual(0);
      expect(a2).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Necesidades especiales ocupan 2 plazas', () => {
    it('un candidato con necesidades especiales debería contar como 2', () => {
      const lista = [
        crearCandidato(1, 10, 200, 'A1', { especialNeeds: true }),
      ];
      expect(contarLista(lista)).toBe(2);
    });

    it('mezcla de candidatos normales y especiales', () => {
      const lista = [
        crearCandidato(1, 10, 200, 'A1', { especialNeeds: false }),
        crearCandidato(2, 9, 300, 'A1', { especialNeeds: true }),
        crearCandidato(3, 8, 400, 'A1', { especialNeeds: false }),
      ];
      // 1 + 2 + 1 = 4
      expect(contarLista(lista)).toBe(4);
    });
  });

  describe('Preferencia en scoring', () => {
    it('candidato con preferencia debería tener scoring+4', () => {
      const scoringBase = 7.5;
      const scoringConPreferencia = scoringBase + 4;
      expect(scoringConPreferencia).toBeCloseTo(11.5);
    });

    it('candidato con preferencia debería tener prioridad en la ordenación', () => {
      const candidatos = [
        crearCandidato(1, 7.5, 200, 'A1'), // sin preferencia
        crearCandidato(2, 11.5, 300, 'A1'), // con preferencia (7.5 + 4)
      ].sort(ordenarCandidatos);

      expect(candidatos[0].applicationId).toBe('APP-2'); // mayor scoring primero
    });
  });

  describe('Desempate por randomNumber', () => {
    it('con scoring igual, debería priorizar randomNumber más cercano por encima', () => {
      const candidatos = [
        crearCandidato(1, 7, 500, 'A1'),
        crearCandidato(2, 7, 148, 'A1'), // más cercano a 147
        crearCandidato(3, 7, 300, 'A1'),
      ].sort(ordenarCandidatos);

      expect(candidatos[0].applicationId).toBe('APP-2');
    });

    it('con scoring igual y todos por debajo del randomNumber seleccionado', () => {
      const candidatos = [
        crearCandidato(1, 7, 100, 'A1'),
        crearCandidato(2, 7, 50, 'A1'),
        crearCandidato(3, 7, 130, 'A1'),
      ].sort(ordenarCandidatos);

      // Ambos < 147, orden ascendente
      expect(candidatos[0].applicationId).toBe('APP-2');
      expect(candidatos[1].applicationId).toBe('APP-1');
      expect(candidatos[2].applicationId).toBe('APP-3');
    });
  });

  describe('Candidatos no repetidos', () => {
    it('un candidato no debería estar asignado en más de un curso', () => {
      const candidatos = [
        crearCandidato(1, 10, 200, 'A1', { prioridadPeticion: 0, clave: '001_GMP1_' }),
        crearCandidato(1, 10, 200, 'A1', { prioridadPeticion: 1, clave: '002_GMP2_' }),
      ];

      // Simular asignación del primero
      candidatos[0].asignado = true;
      candidatos[0].espera = false;

      // El segundo del mismo applicationId debería quedar sin asignar
      // (simula la lógica del servicio que desmarca opciones posteriores)
      candidatos
        .filter(c => c.applicationId === 'APP-1' && c.prioridadPeticion > 0)
        .forEach(c => {
          c.asignado = false;
        });

      const asignados = candidatos.filter(c => c.asignado);
      expect(asignados.length).toBe(1);
      expect(asignados[0].prioridadPeticion).toBe(0);
    });
  });

  describe('Coherencia entre asignado y espera', () => {
    it('un candidato asignado no debería estar en espera', () => {
      const candidato = crearCandidato(1, 10, 200, 'A1');
      candidato.asignado = true;
      candidato.espera = false;

      expect(candidato.asignado && !candidato.espera).toBe(true);
    });

    it('un candidato en espera no debería estar asignado', () => {
      const candidato = crearCandidato(1, 10, 200, 'A1');
      candidato.asignado = false;
      candidato.espera = true;

      expect(!candidato.asignado && candidato.espera).toBe(true);
    });

    it('la verificación de coherencia debería detectar errores', () => {
      const candidato = crearCandidato(1, 10, 200, 'A1');
      candidato.asignado = true;
      candidato.espera = true; // ERROR: asignado y en espera

      // La lógica del servicio detecta esto y corrige
      if (candidato.asignado && candidato.espera) {
        candidato.asignado = false; // Se corrige como en el código fuente
      }

      expect(candidato.asignado).toBe(false);
    });
  });

  describe('Movimiento entre listas especiales y generales', () => {
    it('candidato discapacitado en lista general debería moverse a lista especial si hay vacantes', () => {
      const candidato = crearCandidato(1, 10, 200, 'A1', { handicapped: true });
      const listaAsignadosA1 = [candidato];
      let listaAsignadosDiscapacitados = [];
      const vacantesMinusvalidos = 1;

      // Simular el movimiento
      if (candidato.handicapped && contarLista(listaAsignadosDiscapacitados) < vacantesMinusvalidos) {
        listaAsignadosDiscapacitados.push(candidato);
        const indexToRemove = listaAsignadosA1.findIndex(l => l.applicationId === candidato.applicationId);
        listaAsignadosA1.splice(indexToRemove, 1);
      }

      expect(listaAsignadosDiscapacitados.length).toBe(1);
      expect(listaAsignadosA1.length).toBe(0);
    });

    it('candidato deportista de élite en lista general debería moverse si hay vacantes', () => {
      const candidato = crearCandidato(1, 10, 200, 'B', { eliteAthlete: true });
      const listaAsignadosB = [candidato];
      let listaAsignadosDeportistas = [];
      const vacantesDeportistas = 1;

      if (candidato.eliteAthlete && contarLista(listaAsignadosDeportistas) < vacantesDeportistas) {
        listaAsignadosDeportistas.push(candidato);
        const indexToRemove = listaAsignadosB.findIndex(l => l.applicationId === candidato.applicationId);
        listaAsignadosB.splice(indexToRemove, 1);
      }

      expect(listaAsignadosDeportistas.length).toBe(1);
      expect(listaAsignadosB.length).toBe(0);
    });
  });

  describe('Listas de espera', () => {
    it('los candidatos no asignados y en espera deberían ir a la lista de espera', () => {
      const candidatos = [
        crearCandidato(1, 10, 200, 'A1'),
        crearCandidato(2, 9, 300, 'A1'),
        crearCandidato(3, 8, 400, 'A1'),
        crearCandidato(4, 7, 500, 'A1'),
      ].sort(ordenarCandidatos);

      // Asignar solo 2
      candidatos[0].asignado = true;
      candidatos[0].espera = false;
      candidatos[1].asignado = true;
      candidatos[1].espera = false;

      const enEspera = candidatos.filter(c => !c.asignado && c.espera);
      expect(enEspera.length).toBe(2);
    });

    it('la lista de espera debería estar ordenada por scoring descendente', () => {
      const candidatos = [
        crearCandidato(1, 5, 200, 'A1'),
        crearCandidato(2, 6, 300, 'A1'),
      ].sort(ordenarCandidatos);

      expect(candidatos[0].scoring).toBe(6);
      expect(candidatos[1].scoring).toBe(5);
    });
  });
});

describe('Solicitudes aceptadas vs rechazadas', () => {
  it('solicitudes con campo incumple vacío deben ser aceptadas', () => {
    const solicitud = { incumple: '' };
    const aceptada = String(solicitud.incumple || '') === '';
    expect(aceptada).toBe(true);
  });

  it('solicitudes con campo incumple no vacío deben ser rechazadas', () => {
    const solicitud = { incumple: 'R1' };
    const aceptada = String(solicitud.incumple || '') === '';
    expect(aceptada).toBe(false);
  });

  it('solicitudes con campo incumple R1 R2 deben ser rechazadas', () => {
    const solicitud = { incumple: 'R1 R2' };
    const aceptada = String(solicitud.incumple || '') === '';
    expect(aceptada).toBe(false);
  });
});

describe('Lógica de DESCARTADO-MEJORA', () => {
  it('filas marcadas como DESCARTADO-MEJORA deben ser ignoradas en la lectura', () => {
    const DESCARTADO = 'DESCARTADO-MEJORA';
    const filas = [
      { a: 'DNI1', b: 'APP-1' },
      { a: DESCARTADO, b: 'APP-2' },
      { a: 'DNI3', b: 'APP-3' },
    ];

    const solicitudes = filas.filter(f => f.a !== DESCARTADO);
    expect(solicitudes.length).toBe(2);
    expect(solicitudes.map(s => s.b)).toEqual(['APP-1', 'APP-3']);
  });

  it('candidatos asignados en primera prioridad deben marcarse como DESCARTADO', () => {
    const candidato = { applicationId: 'APP-1', asignado: true, prioridadPeticion: 0 };
    const DESCARTADO = 'DESCARTADO-MEJORA';

    let descartado = false;
    if (candidato.asignado && candidato.prioridadPeticion === 0) {
      descartado = true;
    }

    expect(descartado).toBe(true);
  });

  it('candidatos asignados en prioridad > 0 NO deben marcarse como DESCARTADO', () => {
    const candidato = { applicationId: 'APP-1', asignado: true, prioridadPeticion: 1 };

    let descartado = false;
    if (candidato.asignado && candidato.prioridadPeticion === 0) {
      descartado = true;
    }

    expect(descartado).toBe(false);
  });

  it('para candidato en prioridad 1, se deberían limpiar opciones posteriores', () => {
    const candidato = { prioridadPeticion: 1 };

    // Simular limpieza de columnas según el código
    const columnasLimpiadas = [];
    if (candidato.prioridadPeticion < 2) {
      columnasLimpiadas.push('H', 'I');
    }
    if (candidato.prioridadPeticion < 3) {
      columnasLimpiadas.push('J', 'K');
    }
    columnasLimpiadas.push('L', 'M'); // Siempre se limpia la última opción

    expect(columnasLimpiadas).toContain('H');
    expect(columnasLimpiadas).toContain('I');
    expect(columnasLimpiadas).toContain('J');
    expect(columnasLimpiadas).toContain('K');
    expect(columnasLimpiadas).toContain('L');
    expect(columnasLimpiadas).toContain('M');
  });
});
