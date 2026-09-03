import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripEditionQualifiers } from './searchQuery.ts'

// Vérifié contre OpenLibrary : "My Hero Academia Tome 34 édition collector" renvoie 0 résultat,
// alors que la requête sans le qualificatif renvoie la série. Sans ce nettoyage, un tome marqué
// collector n'affiche aucune couverture du tout.
test('stripEditionQualifiers retire les qualificatifs d edition', () => {
  assert.equal(stripEditionQualifiers('My Hero Academia Tome 34 édition collector'), 'My Hero Academia Tome 34')
  assert.equal(stripEditionQualifiers('One Piece Tome 5 edition collector'), 'One Piece Tome 5')
  assert.equal(stripEditionQualifiers('Berserk Deluxe'), 'Berserk')
  assert.equal(stripEditionQualifiers('Naruto coffret'), 'Naruto')
  assert.equal(stripEditionQualifiers('Akira intégrale'), 'Akira')
})

test('stripEditionQualifiers laisse un titre normal intact', () => {
  assert.equal(stripEditionQualifiers('My Hero Academia Tome 34'), 'My Hero Academia Tome 34')
  assert.equal(stripEditionQualifiers('Dune'), 'Dune')
})
