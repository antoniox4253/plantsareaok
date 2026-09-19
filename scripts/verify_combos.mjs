import { validarIntencionAsyncRankedEstricta } from '../src/engine/asyncP1History.ts'

// Definición de los 5 combos seleccionados por el usuario: 4, 3, 2, 6, 10
const COMBOS = {
  combo4_sombra_pesado: {
    name: 'Combo 4: Sombra Ancestral Pesado',
    deck: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'repeater' },
      { slot: 2, plantId: 'tallnut' },
      { slot: 3, plantId: 'bonkchoy' },
      { slot: 4, plantId: 'squash' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 1, col: 3, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 1, plantId: 'repeater', lane: 1, col: 1, issuedTick: 1014, tick: 1020 },
      { seq: 6, kind: 'plant', slot: 1, plantId: 'repeater', lane: 0, col: 1, issuedTick: 1374, tick: 1380 },
      { seq: 7, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 0, col: 3, issuedTick: 1590, tick: 1596 },
      { seq: 8, kind: 'plant', slot: 1, plantId: 'repeater', lane: 2, col: 1, issuedTick: 1950, tick: 1956 },
      { seq: 9, kind: 'plant', slot: 3, plantId: 'bonkchoy', lane: 1, col: 4, issuedTick: 2262, tick: 2268 },
      { seq: 10, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 2, col: 3, issuedTick: 2499, tick: 2505 },
      { seq: 11, kind: 'plant', slot: 3, plantId: 'bonkchoy', lane: 0, col: 4, issuedTick: 2754, tick: 2760 },
      { seq: 12, kind: 'plant', slot: 3, plantId: 'bonkchoy', lane: 2, col: 4, issuedTick: 3294, tick: 3300 },
      { seq: 13, kind: 'plant', slot: 4, plantId: 'squash', lane: 1, col: 5, issuedTick: 3594, tick: 3600 },
      { seq: 14, kind: 'plant', slot: 1, plantId: 'repeater', lane: 1, col: 2, issuedTick: 4194, tick: 4200 },
      { seq: 15, kind: 'plant', slot: 4, plantId: 'squash', lane: 0, col: 5, issuedTick: 4794, tick: 4800 },
      { seq: 16, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 2, col: 5, issuedTick: 5394, tick: 5400 },
    ]
  },

  combo3_mantequilla_ajo: {
    name: 'Combo 3: Parálisis Mantequilla + Ajo',
    deck: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'kernelpult' },
      { slot: 2, plantId: 'garlic' },
      { slot: 3, plantId: 'wallnut' },
      { slot: 4, plantId: 'repeater' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'garlic', lane: 0, col: 5, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 2, plantId: 'garlic', lane: 2, col: 5, issuedTick: 894, tick: 900 },
      { seq: 6, kind: 'plant', slot: 3, plantId: 'wallnut', lane: 1, col: 5, issuedTick: 1134, tick: 1140 },
      { seq: 7, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 1, col: 1, issuedTick: 1434, tick: 1440 },
      { seq: 8, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 0, col: 1, issuedTick: 1734, tick: 1740 },
      { seq: 9, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 2, col: 1, issuedTick: 2034, tick: 2040 },
      { seq: 10, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 2, issuedTick: 2394, tick: 2400 },
      { seq: 11, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 3, issuedTick: 2754, tick: 2760 },
      { seq: 12, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 1, col: 4, issuedTick: 3114, tick: 3120 },
      { seq: 13, kind: 'plant', slot: 4, plantId: 'repeater', lane: 0, col: 2, issuedTick: 3594, tick: 3600 },
      { seq: 14, kind: 'plant', slot: 4, plantId: 'repeater', lane: 2, col: 2, issuedTick: 4094, tick: 4100 },
      { seq: 15, kind: 'plant', slot: 2, plantId: 'garlic', lane: 0, col: 4, issuedTick: 4694, tick: 4700 },
      { seq: 16, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 1, col: 5, issuedTick: 5294, tick: 5300 },
    ]
  },

  combo2_embudo_ajo: {
    name: 'Combo 2: Embudo Mortal de Ajo',
    deck: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'garlic' },
      { slot: 2, plantId: 'bonkchoy' },
      { slot: 3, plantId: 'wallnut' },
      { slot: 4, plantId: 'repeater' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 1, plantId: 'garlic', lane: 0, col: 5, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 1, plantId: 'garlic', lane: 2, col: 5, issuedTick: 894, tick: 900 },
      { seq: 6, kind: 'plant', slot: 3, plantId: 'wallnut', lane: 1, col: 5, issuedTick: 1134, tick: 1140 },
      { seq: 7, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 1, col: 4, issuedTick: 1434, tick: 1440 },
      { seq: 8, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 1, col: 3, issuedTick: 1734, tick: 1740 },
      { seq: 9, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 1, issuedTick: 2094, tick: 2100 },
      { seq: 10, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 2, issuedTick: 2494, tick: 2500 },
      { seq: 11, kind: 'plant', slot: 4, plantId: 'repeater', lane: 0, col: 1, issuedTick: 2894, tick: 2900 },
      { seq: 12, kind: 'plant', slot: 4, plantId: 'repeater', lane: 2, col: 1, issuedTick: 3294, tick: 3300 },
      { seq: 13, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 0, col: 4, issuedTick: 3694, tick: 3700 },
      { seq: 14, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 2, col: 4, issuedTick: 4094, tick: 4100 },
      { seq: 15, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 1, col: 5, issuedTick: 4794, tick: 4800 },
      { seq: 16, kind: 'plant', slot: 1, plantId: 'garlic', lane: 2, col: 4, issuedTick: 5394, tick: 5400 },
    ]
  },

  combo6_tridente: {
    name: 'Combo 6: Tridente de Tres Líneas',
    deck: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'threepeater' },
      { slot: 2, plantId: 'tallnut' },
      { slot: 3, plantId: 'squash' },
      { slot: 4, plantId: 'repeater' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 1, col: 3, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 1, plantId: 'threepeater', lane: 1, col: 1, issuedTick: 1230, tick: 1236 },
      { seq: 6, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 0, col: 3, issuedTick: 1594, tick: 1600 },
      { seq: 7, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 2, col: 3, issuedTick: 1894, tick: 1900 },
      { seq: 8, kind: 'plant', slot: 1, plantId: 'threepeater', lane: 1, col: 2, issuedTick: 2394, tick: 2400 },
      { seq: 9, kind: 'plant', slot: 3, plantId: 'squash', lane: 1, col: 4, issuedTick: 2894, tick: 2900 },
      { seq: 10, kind: 'plant', slot: 4, plantId: 'repeater', lane: 0, col: 1, issuedTick: 3394, tick: 3400 },
      { seq: 11, kind: 'plant', slot: 4, plantId: 'repeater', lane: 2, col: 1, issuedTick: 3894, tick: 3900 },
      { seq: 12, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 1, col: 4, issuedTick: 4394, tick: 4400 },
      { seq: 13, kind: 'plant', slot: 3, plantId: 'squash', lane: 0, col: 4, issuedTick: 4894, tick: 4900 },
      { seq: 14, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 2, col: 5, issuedTick: 5394, tick: 5400 },
      { seq: 15, kind: 'plant', slot: 3, plantId: 'squash', lane: 2, col: 4, issuedTick: 5794, tick: 5800 },
    ]
  },

  combo10_rush: {
    name: 'Combo 10: Rush Agresivo de Presión Temprana',
    deck: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'bonkchoy' },
      { slot: 2, plantId: 'squash' },
      { slot: 3, plantId: 'peashooter' },
      { slot: 4, plantId: 'wallnut' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 1, plantId: 'bonkchoy', lane: 1, col: 3, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'squash', lane: 1, col: 4, issuedTick: 744, tick: 750 },
      { seq: 5, kind: 'plant', slot: 4, plantId: 'wallnut', lane: 1, col: 4, issuedTick: 1044, tick: 1050 },
      { seq: 6, kind: 'plant', slot: 1, plantId: 'bonkchoy', lane: 0, col: 3, issuedTick: 1344, tick: 1350 },
      { seq: 7, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 1644, tick: 1650 },
      { seq: 8, kind: 'plant', slot: 3, plantId: 'peashooter', lane: 1, col: 1, issuedTick: 1944, tick: 1950 },
      { seq: 9, kind: 'plant', slot: 4, plantId: 'wallnut', lane: 0, col: 4, issuedTick: 2244, tick: 2250 },
      { seq: 10, kind: 'plant', slot: 1, plantId: 'bonkchoy', lane: 2, col: 3, issuedTick: 2544, tick: 2550 },
      { seq: 11, kind: 'plant', slot: 2, plantId: 'squash', lane: 0, col: 5, issuedTick: 2894, tick: 2900 },
      { seq: 12, kind: 'plant', slot: 3, plantId: 'peashooter', lane: 0, col: 1, issuedTick: 3294, tick: 3300 },
      { seq: 13, kind: 'plant', slot: 3, plantId: 'peashooter', lane: 2, col: 1, issuedTick: 3694, tick: 3700 },
      { seq: 14, kind: 'plant', slot: 4, plantId: 'wallnut', lane: 2, col: 4, issuedTick: 4194, tick: 4200 },
      { seq: 15, kind: 'plant', slot: 2, plantId: 'squash', lane: 2, col: 5, issuedTick: 4694, tick: 4700 },
      { seq: 16, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 1, col: 5, issuedTick: 5194, tick: 5200 },
    ]
  }
}

// Validar cada combo
let hasError = false
for (const [key, combo] of Object.entries(COMBOS)) {
  console.log(`\nValidando ${combo.name}...`)
  for (const act of combo.actions) {
    const val = validarIntencionAsyncRankedEstricta(act)
    if (!val.ok) {
      console.error(`❌ Falló en acción seq ${act.seq} (${act.plantId}):`, val.reason, val.details)
      hasError = true
    }
  }
  console.log(`✅ ${combo.name}: ${combo.actions.length} acciones validadas perfectamente con tick relation!`)
}

if (!hasError) {
  console.log('\n🎉 TODOS LOS 5 COMBOS SON 100% VÁLIDOS PARA EL PROTOCOLO AUTORITATIVO!')
}
