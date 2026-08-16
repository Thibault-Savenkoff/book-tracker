import { writable } from 'svelte/store'

export type View =
  | { name: 'library' }
  | { name: 'add' }
  | { name: 'book'; id: string }

export const currentView = writable<View>({ name: 'library' })
