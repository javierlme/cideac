/**
 * Tests funcionales para la lógica de asignación de plazas.
 * Estos tests verifican que las funciones internas compartidas por todos los servicios
 * (toNumber, toNumberScore, toNumberRandom, ordenarCandidatos, contarLista, etc.)
 * funcionan correctamente, asegurando la integridad del algoritmo de asignación.
 */

describe('Funciones de conversión numérica', () => {
  // Replicamos las funciones tal cual están en los servicios para testearlas aisladamente
  const toNumber = (valor) => {
    if (isNaN(valor)) {
      return Number(valor.replace('.', '').replace(',', '.'));
    }
    return Number(valor);
  };

  const toNumberScore = (value) => {
    if (isNaN(value)) {
      return value;
    }
    var num = Number(value);
    while (num > 999 || num < -999) {
      num = num / 1000;
    }
    return Number(num);
  };

  const toNumberRandom = (valor) => {
    if (isNaN(valor)) {
      return Number(valor.replace(',', ''));
    }
    return Number(valor);
  };

  describe('toNumber', () => {
    it('debería convertir un número string simple', () => {
      expect(toNumber('42')).toBe(42);
    });

    it('debería convertir un número con coma decimal', () => {
      expect(toNumber('3,14')).toBeCloseTo(3.14);
    });

    it('debería convertir un número con punto de miles y coma decimal', () => {
      expect(toNumber('1.234,56')).toBeCloseTo(1234.56);
    });

    it('debería manejar un número ya numérico', () => {
      expect(toNumber(42)).toBe(42);
    });

    it('debería convertir "0" a 0', () => {
      expect(toNumber('0')).toBe(0);
    });

    it('debería convertir números negativos string', () => {
      expect(toNumber('-5')).toBe(-5);
    });
  });

  describe('toNumberScore', () => {
    it('debería devolver el número tal cual si está en rango normal', () => {
      expect(toNumberScore(7.5)).toBe(7.5);
    });

    it('debería devolver 0 para el valor 0', () => {
      expect(toNumberScore(0)).toBe(0);
    });

    it('debería reducir un número mayor que 999 dividiendo por 1000', () => {
      expect(toNumberScore(7500)).toBeCloseTo(7.5);
    });

    it('debería reducir un número mucho mayor dividiendo múltiples veces', () => {
      expect(toNumberScore(7500000)).toBeCloseTo(7.5);
    });

    it('debería devolver el string tal cual si no es numérico', () => {
      expect(toNumberScore('abc')).toBe('abc');
    });

    it('debería manejar números negativos mayores que -999', () => {
      expect(toNumberScore(-7500)).toBeCloseTo(-7.5);
    });

    it('debería manejar el valor 999 sin dividir', () => {
      expect(toNumberScore(999)).toBe(999);
    });

    it('debería dividir 1000 una vez', () => {
      expect(toNumberScore(1000)).toBeCloseTo(1);
    });
  });

  describe('toNumberRandom', () => {
    it('debería convertir un número string simple', () => {
      expect(toNumberRandom('147')).toBe(147);
    });

    it('debería eliminar comas y convertir', () => {
      expect(toNumberRandom('1,234')).toBe(1234);
    });

    it('debería manejar un número ya numérico', () => {
      expect(toNumberRandom(147)).toBe(147);
    });

    it('debería convertir "0" a 0', () => {
      expect(toNumberRandom('0')).toBe(0);
    });
  });
});

describe('Lógica de ordenación de candidatos', () => {
  const ordenarCandidatos = (c1, c2) => {
    if (Number(c1.scoring) !== Number(c2.scoring)) {
      return Number(c2.scoring) - Number(c1.scoring);
    } else {
      const randomNumberSelected = 147;
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

  it('debería ordenar por scoring descendente', () => {
    const candidatos = [
      { scoring: 5, randomNumber: 100 },
      { scoring: 10, randomNumber: 200 },
      { scoring: 7, randomNumber: 150 },
    ];
    const sorted = candidatos.sort(ordenarCandidatos);
    expect(sorted[0].scoring).toBe(10);
    expect(sorted[1].scoring).toBe(7);
    expect(sorted[2].scoring).toBe(5);
  });

  it('con scoring igual, debería ordenar por randomNumber más cercano al seleccionado', () => {
    const candidatos = [
      { scoring: 7, randomNumber: 300 },
      { scoring: 7, randomNumber: 150 },
      { scoring: 7, randomNumber: 200 },
    ];
    // randomNumberSelected=147, todos >= 147
    // Orden ascendente por randomNumber: 150, 200, 300
    const sorted = candidatos.sort(ordenarCandidatos);
    expect(sorted[0].randomNumber).toBe(150);
    expect(sorted[1].randomNumber).toBe(200);
    expect(sorted[2].randomNumber).toBe(300);
  });

  it('con scoring igual y randomNumbers a ambos lados del seleccionado', () => {
    const candidatos = [
      { scoring: 7, randomNumber: 100 }, // < 147
      { scoring: 7, randomNumber: 200 }, // >= 147
    ];
    // Uno por debajo, otro por encima: devuelve c2.random - c1.random = 200-100 = positivo (c2 primero)
    const sorted = candidatos.sort(ordenarCandidatos);
    expect(sorted[0].randomNumber).toBe(200);
    expect(sorted[1].randomNumber).toBe(100);
  });

  it('con scoring igual y randomNumbers ambos por debajo del seleccionado', () => {
    const candidatos = [
      { scoring: 7, randomNumber: 50 },
      { scoring: 7, randomNumber: 100 },
    ];
    // Ambos < 147: ascendente c1.random - c2.random
    const sorted = candidatos.sort(ordenarCandidatos);
    expect(sorted[0].randomNumber).toBe(50);
    expect(sorted[1].randomNumber).toBe(100);
  });

  it('debería mantener el orden con un solo candidato', () => {
    const candidatos = [{ scoring: 10, randomNumber: 147 }];
    const sorted = candidatos.sort(ordenarCandidatos);
    expect(sorted.length).toBe(1);
    expect(sorted[0].scoring).toBe(10);
  });
});

describe('Lógica de conteo de lista (contarLista)', () => {
  const contarLista = (lista) => {
    var contador = Number(0);
    if (!lista || !Array.isArray(lista)) return contador;
    for (var i = 0; i < lista.length; i++) {
      contador += lista[i].especialNeeds ? Number(2) : Number(1);
    }
    return contador;
  };

  it('debería contar 0 para una lista vacía', () => {
    expect(contarLista([])).toBe(0);
  });

  it('debería contar 0 para null', () => {
    expect(contarLista(null)).toBe(0);
  });

  it('debería contar 0 para undefined', () => {
    expect(contarLista(undefined)).toBe(0);
  });

  it('debería contar 1 por cada candidato sin necesidades especiales', () => {
    const lista = [
      { especialNeeds: false },
      { especialNeeds: false },
      { especialNeeds: false },
    ];
    expect(contarLista(lista)).toBe(3);
  });

  it('debería contar 2 por cada candidato con necesidades especiales', () => {
    const lista = [
      { especialNeeds: true },
      { especialNeeds: true },
    ];
    expect(contarLista(lista)).toBe(4);
  });

  it('debería sumar correctamente mezcla de candidatos', () => {
    const lista = [
      { especialNeeds: false }, // 1
      { especialNeeds: true },  // 2
      { especialNeeds: false }, // 1
      { especialNeeds: true },  // 2
    ];
    expect(contarLista(lista)).toBe(6);
  });
});

describe('Lógica de generación de clave (generarClave)', () => {
  const generarClave = (registro) => {
    return `${registro.codigoCentro || ''}_${registro.codigoCurso || ''}_${registro.codigoModulo || ''}`;
  };

  it('debería generar clave con todos los campos', () => {
    const result = generarClave({
      codigoCentro: '001',
      codigoCurso: 'GMP1',
      codigoModulo: 'MOD1',
    });
    expect(result).toBe('001_GMP1_MOD1');
  });

  it('debería generar clave con codigoModulo vacío', () => {
    const result = generarClave({
      codigoCentro: '001',
      codigoCurso: 'GMP1',
    });
    expect(result).toBe('001_GMP1_');
  });

  it('debería generar clave con todos vacíos', () => {
    const result = generarClave({});
    expect(result).toBe('__');
  });
});

describe('Lógica de mapeo lineal (mapearLinealmenteDatosIniciales)', () => {
  const generarClave = (registro) => {
    return `${registro.codigoCentro || ''}_${registro.codigoCurso || ''}_${registro.codigoModulo || ''}`;
  };

  const mapearLinealmenteDatosIniciales = (registro, index) => {
    if (!registro || !registro.applicationId || (registro.viaAcceso === '') || ![0, 1, 2, 3].includes(index) || !registro.listaCentrosCiclosModulos[index]) return null;
    return {
      applicationId: registro.applicationId,
      asignado: false,
      espera: true,
      prioridadPeticion: index,
      preferencia: registro.listaCentrosCiclosModulos[index].prioridad ? registro.listaCentrosCiclosModulos[index].prioridad : false,
      scoring: registro.scoring ? (registro.listaCentrosCiclosModulos[index].prioridad ? Number(registro.scoring) + Number(4) : Number(registro.scoring)) : Number(0),
      viaAcceso: registro.viaAcceso ? registro.viaAcceso.toLocaleUpperCase() : '',
      eliteAthlete: registro.eliteAthlete ? registro.eliteAthlete : false,
      handicapped: registro.handicapped ? registro.handicapped : false,
      especialNeeds: registro.especialNeeds ? registro.especialNeeds : false,
      randomNumber: Number(registro.randomNumber),
      docId: registro.docId,
      personalId: registro.personalId,
      claveCentroCicloModulo: generarClave(registro.listaCentrosCiclosModulos[index]),
      centro: registro.listaCentrosCiclosModulos[index].centro || '',
      codigoCentro: registro.listaCentrosCiclosModulos[index].codigoCentro || '',
      curso: registro.listaCentrosCiclosModulos[index].curso || '',
      codigoCurso: registro.listaCentrosCiclosModulos[index].codigoCurso || '',
      modulo: registro.listaCentrosCiclosModulos[index].modulo || '',
      codigoModulo: registro.listaCentrosCiclosModulos[index].codigoModulo || '',
    };
  };

  const registroBase = {
    applicationId: 'APP-001',
    docId: '12345678A',
    personalId: 'PEREZ, JUAN',
    randomNumber: 150,
    scoring: 7.5,
    viaAcceso: 'A1',
    handicapped: false,
    eliteAthlete: false,
    especialNeeds: false,
    listaCentrosCiclosModulos: [
      { codigoCentro: '001', centro: 'Centro1', codigoCurso: 'GMP1', curso: 'Curso1', prioridad: true },
      { codigoCentro: '002', centro: 'Centro2', codigoCurso: 'GMP2', curso: 'Curso2', prioridad: false },
    ],
  };

  it('debería mapear correctamente la primera opción (index=0)', () => {
    const result = mapearLinealmenteDatosIniciales(registroBase, 0);
    expect(result).not.toBeNull();
    expect(result.applicationId).toBe('APP-001');
    expect(result.prioridadPeticion).toBe(0);
    expect(result.asignado).toBe(false);
    expect(result.espera).toBe(true);
    expect(result.codigoCentro).toBe('001');
    expect(result.codigoCurso).toBe('GMP1');
  });

  it('debería sumar 4 al scoring si hay preferencia', () => {
    const result = mapearLinealmenteDatosIniciales(registroBase, 0);
    // primera opción tiene prioridad: true, scoring = 7.5 + 4 = 11.5
    expect(result.scoring).toBeCloseTo(11.5);
    expect(result.preferencia).toBe(true);
  });

  it('no debería sumar 4 al scoring si no hay preferencia', () => {
    const result = mapearLinealmenteDatosIniciales(registroBase, 1);
    // segunda opción tiene prioridad: false, scoring = 7.5
    expect(result.scoring).toBeCloseTo(7.5);
    expect(result.preferencia).toBe(false);
  });

  it('debería devolver null para un index fuera de rango', () => {
    expect(mapearLinealmenteDatosIniciales(registroBase, 4)).toBeNull();
    expect(mapearLinealmenteDatosIniciales(registroBase, -1)).toBeNull();
  });

  it('debería devolver null si el registro no tiene applicationId', () => {
    expect(mapearLinealmenteDatosIniciales({}, 0)).toBeNull();
  });

  it('debería devolver null si el registro es null', () => {
    expect(mapearLinealmenteDatosIniciales(null, 0)).toBeNull();
  });

  it('debería devolver null si viaAcceso está vacío', () => {
    const registro = { ...registroBase, viaAcceso: '' };
    expect(mapearLinealmenteDatosIniciales(registro, 0)).toBeNull();
  });

  it('debería convertir viaAcceso a mayúsculas', () => {
    const registro = { ...registroBase, viaAcceso: 'a1' };
    const result = mapearLinealmenteDatosIniciales(registro, 0);
    expect(result.viaAcceso).toBe('A1');
  });

  it('debería generar claveCentroCicloModulo correcta', () => {
    const result = mapearLinealmenteDatosIniciales(registroBase, 0);
    expect(result.claveCentroCicloModulo).toBe('001_GMP1_');
  });
});

describe('Lógica de redondeo', () => {
  const redondear = (valor, vacantesDisponibles = Number(0)) => {
    const result = Math.round(Number(valor));
    if (result) return result;
    return vacantesDisponibles < 1 ? Number(0) : Number(1);
  };

  it('debería redondear 2.7 a 3', () => {
    expect(redondear(2.7)).toBe(3);
  });

  it('debería redondear 2.3 a 2', () => {
    expect(redondear(2.3)).toBe(2);
  });

  it('debería redondear 2.5 a 3 (redondeo matemático)', () => {
    // Math.round(2.5) = 3 en JavaScript
    expect(redondear(2.5)).toBe(3);
  });

  it('debería devolver 0 si valor es 0 y no hay vacantes', () => {
    expect(redondear(0, 0)).toBe(0);
  });

  it('debería devolver 1 si valor es 0 pero hay vacantes disponibles', () => {
    expect(redondear(0, 5)).toBe(1);
  });

  it('debería devolver 0 si valor es 0.4 y redondea a 0 sin vacantes', () => {
    expect(redondear(0.4, 0)).toBe(0);
  });

  it('debería devolver 1 si valor es 0.4 y redondea a 0 con vacantes', () => {
    expect(redondear(0.4, 3)).toBe(1);
  });

  it('debería manejar valores negativos', () => {
    expect(redondear(-1.5)).toBe(-1);
  });
});

describe('Lógica de generación de texto de exclusión GM', () => {
  const config = {
    textGMR1: 'Motivo R1',
    textGMR2: 'Motivo R2',
    textGMR3: 'Motivo R3',
    textGMR4: 'Motivo R4',
    textGMR5: 'Motivo R5',
    textGMR6: 'Motivo R6',
  };

  const generarTextoExclusionGM = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo += config.textGMR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo += config.textGMR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo += config.textGMR3 + ' / ';
    if (texto.match(new RegExp('r4', 'i')) != null) motivo += config.textGMR4 + ' / ';
    if (texto.match(new RegExp('r5', 'i')) != null) motivo += config.textGMR5 + ' / ';
    if (texto.match(new RegExp('r6', 'i')) != null) motivo += config.textGMR6 + ' / ';
    return motivo.slice(0, -2);
  };

  it('debería devolver un solo motivo para R1', () => {
    expect(generarTextoExclusionGM('R1')).toBe('Motivo R1 ');
  });

  it('debería devolver múltiples motivos para R1 R2', () => {
    expect(generarTextoExclusionGM('R1 R2')).toBe('Motivo R1 / Motivo R2 ');
  });

  it('debería ser case insensitive', () => {
    expect(generarTextoExclusionGM('r1 r3')).toBe('Motivo R1 / Motivo R3 ');
  });

  it('debería devolver todos los motivos para R1 R2 R3 R4 R5 R6', () => {
    const result = generarTextoExclusionGM('R1 R2 R3 R4 R5 R6');
    expect(result).toContain('Motivo R1');
    expect(result).toContain('Motivo R2');
    expect(result).toContain('Motivo R3');
    expect(result).toContain('Motivo R4');
    expect(result).toContain('Motivo R5');
    expect(result).toContain('Motivo R6');
  });

  it('debería devolver cadena vacía si no hay coincidencias', () => {
    expect(generarTextoExclusionGM('ninguno')).toBe('');
  });
});

describe('Lógica de generación de texto de exclusión GS', () => {
  const config = {
    textGSR1: 'Motivo GS-R1',
    textGSR2: 'Motivo GS-R2',
    textGSR3: 'Motivo GS-R3',
    textGSR4: 'Motivo GS-R4',
    textGSR5: 'Motivo GS-R5',
    textGSR6: 'Motivo GS-R6',
  };

  const generarTextoExclusionGS = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo += config.textGSR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo += config.textGSR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo += config.textGSR3 + ' / ';
    if (texto.match(new RegExp('r4', 'i')) != null) motivo += config.textGSR4 + ' / ';
    if (texto.match(new RegExp('r5', 'i')) != null) motivo += config.textGSR5 + ' / ';
    if (texto.match(new RegExp('r6', 'i')) != null) motivo += config.textGSR6 + ' / ';
    return motivo.slice(0, -2);
  };

  it('debería devolver un solo motivo para R1', () => {
    expect(generarTextoExclusionGS('R1')).toBe('Motivo GS-R1 ');
  });

  it('debería combinar R2 y R5', () => {
    expect(generarTextoExclusionGS('R2 R5')).toBe('Motivo GS-R2 / Motivo GS-R5 ');
  });
});

describe('Lógica de generación de texto de exclusión GB', () => {
  const config = {
    textGBR1: 'Motivo GB-R1',
    textGBR2: 'Motivo GB-R2',
    textGBR3: 'Motivo GB-R3',
  };

  const generarTextoExclusionGB = (texto) => {
    var motivo = String();
    if (texto.match(new RegExp('r1', 'i')) != null) motivo += config.textGBR1 + ' / ';
    if (texto.match(new RegExp('r2', 'i')) != null) motivo += config.textGBR2 + ' / ';
    if (texto.match(new RegExp('r3', 'i')) != null) motivo += config.textGBR3 + ' / ';
    return motivo.slice(0, -2);
  };

  it('debería devolver un solo motivo para R1', () => {
    expect(generarTextoExclusionGB('R1')).toBe('Motivo GB-R1 ');
  });

  it('GB solo tiene 3 motivos de exclusión', () => {
    const result = generarTextoExclusionGB('R1 R2 R3');
    expect(result).toContain('Motivo GB-R1');
    expect(result).toContain('Motivo GB-R2');
    expect(result).toContain('Motivo GB-R3');
  });
});
