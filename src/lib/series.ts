/** Déduit le nom de série et le numéro de tome d'un titre ("My Hero Academia T05",
 * "One Piece Tome 5", "One Piece Vol. 5", "One Piece 5") — pas de champ dédié dans les
 * sources externes, donc on parse le titre. Partagé entre la recherche (regroupement par
 * série) et la collection (vue "séries" avec les tomes manquants). */
export function parseSeriesVolume(title: string): { series: string; volume: number | null } {
  const m = title.match(/^(.*?)[\s,:-]*(?:vol\.?|tome|t\.?)\s*0*(\d+)$/i) ?? title.match(/^(.*?)\s+0*(\d+)$/)
  if (m && m[1].trim().length > 1) return { series: m[1].trim(), volume: parseInt(m[2], 10) }
  return { series: title.trim(), volume: null }
}
