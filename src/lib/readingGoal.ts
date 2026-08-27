import { writable } from 'svelte/store'

/** Objectif annuel de lecture — préférence locale à l'appareil, pas une donnée de la collection. */
function initial(): number {
  const stored = localStorage.getItem('readingGoal')
  const n = stored ? Number(stored) : NaN
  return Number.isFinite(n) && n > 0 ? n : 24
}

export const readingGoal = writable<number>(initial())

readingGoal.subscribe((value) => {
  localStorage.setItem('readingGoal', String(value))
})
