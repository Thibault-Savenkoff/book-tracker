export const CATEGORY_LABEL: Record<string, string> = {
  roman: 'Roman',
  bd: 'BD',
  manga: 'Manga',
  comics: 'Comics',
  autre: 'Autre',
}

export const CATEGORY_COLOR: Record<string, string> = {
  roman: '#e2705f',
  bd: '#6fb37e',
  manga: '#d4a52c',
  comics: '#6a92d6',
  autre: 'rgba(242, 242, 245, 0.55)',
}

export const CATEGORY_GRADIENT: Record<string, string> = {
  roman: 'linear-gradient(160deg,#3a2321,#1c1211)',
  bd: 'linear-gradient(160deg,#20301f,#121a11)',
  manga: 'linear-gradient(160deg,#332a12,#1a1509)',
  comics: 'linear-gradient(160deg,#1e2636,#10141d)',
  autre: 'linear-gradient(160deg,#2a2a2c,#161616)',
}

export function categoryBg(category: string): string {
  const hex = CATEGORY_COLOR[category] ?? CATEGORY_COLOR.autre
  if (!hex.startsWith('#')) return 'rgba(242, 242, 245, 0.14)'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.14)`
}

export const STATUS_LABEL: Record<string, string> = {
  wishlist: 'Envie de lire',
  reading: 'En cours',
  read: 'Lu',
}
