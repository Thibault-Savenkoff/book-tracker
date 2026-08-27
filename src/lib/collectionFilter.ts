import { writable } from 'svelte/store'

/** Partagés entre le header (barre de recherche) et la sidebar (raccourcis de genre) d'un côté,
 * et la page Collection (qui applique le filtre) de l'autre. */
export const searchQuery = writable('')
export const filterCategory = writable('Toutes')
