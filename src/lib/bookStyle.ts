export const CATEGORY_LABEL: Record<string, string> = {
  roman: 'Roman',
  bd: 'BD',
  manga: 'Manga',
  comics: 'Comics',
  autre: 'Autre',
}

export const CATEGORY_COLOR: Record<string, string> = {
  roman: '#EF4444',
  manga: '#6366F1',
  bd: '#10B981',
  comics: '#F59E0B',
  autre: '#94A3B8',
}

export const CATEGORY_GRADIENT: Record<string, string> = {
  roman: 'linear-gradient(160deg,#f87171,#b91c1c)',
  bd: 'linear-gradient(160deg,#34d399,#047857)',
  manga: 'linear-gradient(160deg,#818cf8,#4338ca)',
  comics: 'linear-gradient(160deg,#fbbf24,#b45309)',
  autre: 'linear-gradient(160deg,#cbd5e1,#64748b)',
}

/** Classes Tailwind pour les badges de genre (fond/texte/bordure, clair + sombre). */
export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  roman:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-accent-roman dark:border-red-500/20',
  manga:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-accent-manga dark:border-indigo-500/20',
  bd: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-accent-bd dark:border-emerald-500/20',
  comics:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-accent-comics dark:border-amber-500/20',
  autre: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10',
}

/** Couleur du point associé à un genre (listes/légendes). */
export const CATEGORY_DOT_CLASS: Record<string, string> = {
  roman: 'bg-accent-roman',
  manga: 'bg-accent-manga',
  bd: 'bg-accent-bd',
  comics: 'bg-accent-comics',
  autre: 'bg-slate-400',
}

/** Même palette, pour les barres de répartition (Stats). */
export const CATEGORY_BAR_CLASS = CATEGORY_DOT_CLASS

export function categoryBg(category: string): string {
  const hex = CATEGORY_COLOR[category] ?? CATEGORY_COLOR.autre
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.12)`
}

export const STATUS_LABEL: Record<string, string> = {
  wishlist: 'À lire',
  reading: 'En cours',
  read: 'Terminé',
  abandoned: 'Abandonné',
}

/** Chip de sélection (catégorie, statut) : même style partout où on choisit une valeur
 * parmi quelques-unes. */
export function chipClass(active: boolean): string {
  return active
    ? 'px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-indigo-600 text-white'
    : 'px-3 py-1.5 rounded-lg text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5'
}
