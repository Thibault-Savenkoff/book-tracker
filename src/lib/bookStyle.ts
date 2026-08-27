export const CATEGORY_LABEL: Record<string, string> = {
  roman: 'Roman',
  bd: 'BD',
  manga: 'Manga',
  comics: 'Comics',
  autre: 'Autre',
}

export const CATEGORY_COLOR: Record<string, string> = {
  roman: '#b1462b',
  bd: '#3f6b4a',
  manga: '#b5811f',
  comics: '#375684',
  autre: '#6b6153',
}

export const CATEGORY_GRADIENT: Record<string, string> = {
  roman: 'linear-gradient(160deg,#c96b4a,#8a3a22)',
  bd: 'linear-gradient(160deg,#5f9470,#325342)',
  manga: 'linear-gradient(160deg,#d9a53f,#9c6d1e)',
  comics: 'linear-gradient(160deg,#5c7fb0,#2d4468)',
  autre: 'linear-gradient(160deg,#a89c8a,#645a4c)',
}

export function categoryBg(category: string): string {
  const hex = CATEGORY_COLOR[category] ?? CATEGORY_COLOR.autre
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.12)`
}

export const STATUS_LABEL: Record<string, string> = {
  wishlist: 'Envie de lire',
  reading: 'En cours',
  read: 'Lu',
}
