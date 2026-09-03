import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guessCategory, looksLikeIsbn, groupBySeries, resultKey, foundVolume, volumeRange, bookRow } from './addBook.ts'
import type { BookLookupResult } from './bookLookup.ts'

function book(partial: Partial<BookLookupResult> & { title: string }): BookLookupResult {
  return { isbn: null, authors: [], publisher: null, cover_url: null, pages: null, ...partial }
}

test('looksLikeIsbn reconnaît ISBN-10 et ISBN-13, tirets et espaces ignorés', () => {
  assert.equal(looksLikeIsbn('9782505011118'), true)
  assert.equal(looksLikeIsbn('978-2-505-01111-8'), true)
  assert.equal(looksLikeIsbn('2505011117'), true)
  assert.equal(looksLikeIsbn('250501111X'), true)
  assert.equal(looksLikeIsbn('One Piece'), false)
  assert.equal(looksLikeIsbn('12345'), false)
})

test('guessCategory : les tags priment sur tout', () => {
  assert.equal(guessCategory([book({ title: 'x', categories: ['Shonen manga'] })]), 'manga')
  assert.equal(guessCategory([book({ title: 'x', categories: ['Comics & Graphic Novels'] })]), 'comics')
  assert.equal(guessCategory([book({ title: 'x', categories: ['Bande dessinée'] })]), 'bd')
})

test('guessCategory : un éditeur manga connu suffit sans tag', () => {
  assert.equal(guessCategory([book({ title: 'x', publisher: 'Ki-oon' })]), 'manga')
  assert.equal(guessCategory([book({ title: 'x', publisher: 'Glénat Manga' })]), 'manga')
})

test('guessCategory : un livre seul sans indice est un roman, plusieurs tomes un manga', () => {
  assert.equal(guessCategory([book({ title: 'Dune', publisher: 'Robert Laffont' })]), 'roman')
  assert.equal(guessCategory([book({ title: 'A 1' }), book({ title: 'A 2' })]), 'manga')
})

test('groupBySeries regroupe les tomes et trie par numéro', () => {
  const groups = groupBySeries([book({ title: 'One Piece T03' }), book({ title: 'One Piece T01' }), book({ title: 'Dune' })])
  assert.equal(groups.length, 2)
  const op = groups.find((g) => g.series === 'One Piece')!
  assert.deepEqual(op.items.map((i) => i.title), ['One Piece T01', 'One Piece T03'])
})

test('groupBySeries place les titres sans numéro après les vrais tomes', () => {
  // Sinon un résultat générique mal indexé sert de vignette du groupe à la place du tome 1.
  const [g] = groupBySeries([book({ title: 'Naruto' }), book({ title: 'Naruto T01' })])
  assert.equal(g.items[0].title, 'Naruto T01')
})

test('foundVolume retrouve un tome par son numéro', () => {
  const g = { items: [book({ title: 'Bleach T01' }), book({ title: 'Bleach T02' })] }
  assert.equal(foundVolume(g, 2)?.title, 'Bleach T02')
  assert.equal(foundVolume(g, 9), null)
})

test('volumeRange borne la plage à 300 tomes', () => {
  assert.deepEqual(volumeRange(1, 3), [1, 2, 3])
  assert.deepEqual(volumeRange(5, 5), [5])
  // Une saisie aberrante ne doit pas générer des dizaines de milliers de lignes.
  assert.equal(volumeRange(1, 99999).length, 300)
  // Plage inversée : rien, plutôt qu'une longueur négative.
  assert.deepEqual(volumeRange(10, 2), [])
})

test('resultKey préfère l ISBN, sinon le titre', () => {
  assert.equal(resultKey(book({ title: 'Dune', isbn: '123' })), '123')
  assert.equal(resultKey(book({ title: 'Dune' })), 'Dune')
})

test('bookRow remplace un titre vide par un libellé par défaut', () => {
  const row = bookRow(book({ title: '' }), 'u1', 'roman', 'wishlist')
  assert.equal(row.title, 'Sans titre')
  assert.equal(row.user_id, 'u1')
  assert.equal(row.series, null)
})
