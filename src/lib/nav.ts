import { writable } from 'svelte/store'

export type View =
  | { name: 'collection' }
  | { name: 'planning' }
  | { name: 'stats' }
  | { name: 'add'; query?: string }
  | { name: 'book'; id: string }

export const currentView = writable<View>({ name: 'collection' })

export const NAV_SCREENS = ['collection', 'planning', 'stats'] as const
