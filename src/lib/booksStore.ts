import { writable } from 'svelte/store'
import type { Book } from './supabase'

/** Reflet en lecture seule de la collection chargée par Collection.svelte — sert à afficher
 * les compteurs réels dans la sidebar sans dupliquer la requête Supabase. */
export const booksStore = writable<Book[]>([])
