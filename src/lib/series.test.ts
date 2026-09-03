import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSeriesVolume } from './series.ts'

// Les titres viennent des APIs externes, jamais d'un champ dédié : ce parsing est la seule
// source du regroupement par série et de la détection des tomes manquants.
const cases: [string, { series: string; volume: number | null }][] = [
  ['My Hero Academia T05', { series: 'My Hero Academia', volume: 5 }],
  ['One Piece Tome 5', { series: 'One Piece', volume: 5 }],
  ['One Piece Vol. 5', { series: 'One Piece', volume: 5 }],
  ['One Piece 5', { series: 'One Piece', volume: 5 }],
  ['Berserk t.12', { series: 'Berserk', volume: 12 }],
  ['Naruto - 7', { series: 'Naruto', volume: 7 }],
  ['Vagabond, Vol. 3', { series: 'Vagabond', volume: 3 }],
  ['  Bleach   T01  ', { series: 'Bleach', volume: 1 }],
  // Un roman sans numéro reste entier, volume null : pas de série déduite.
  ['Le Seigneur des Anneaux', { series: 'Le Seigneur des Anneaux', volume: null }],
  ['Dune', { series: 'Dune', volume: null }],
]

for (const [title, expected] of cases) {
  test(`parseSeriesVolume(${JSON.stringify(title)})`, () => {
    assert.deepEqual(parseSeriesVolume(title), expected)
  })
}

// Cas limites connus : un titre qui se termine par une année est indiscernable d'un numéro de
// tome. On fige le comportement actuel pour que tout changement du regex soit visible.
test('un titre finissant par une année est lu comme un tome (limite connue)', () => {
  assert.deepEqual(parseSeriesVolume('Akira 1988'), { series: 'Akira', volume: 1988 })
})

test('un titre trop court avant le numéro nest pas découpé', () => {
  assert.deepEqual(parseSeriesVolume('X 3'), { series: 'X 3', volume: null })
})
