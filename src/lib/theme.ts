import { writable } from 'svelte/store'

type Theme = 'dark' | 'light'

function initial(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' ? 'light' : 'dark'
}

export const theme = writable<Theme>(initial())

theme.subscribe((value) => {
  document.documentElement.classList.toggle('dark', value === 'dark')
  localStorage.setItem('theme', value)
})

export function toggleTheme() {
  theme.update((t) => (t === 'dark' ? 'light' : 'dark'))
}
