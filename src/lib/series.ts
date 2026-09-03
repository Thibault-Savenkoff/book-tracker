/** Déduit le nom de série et le numéro de tome d'un titre ("My Hero Academia T05",
 * "One Piece Tome 5", "One Piece Vol. 5", "One Piece 5") — pas de champ dédié dans les
 * sources externes, donc on parse le titre. Partagé entre la recherche (regroupement par
 * série) et la collection (vue "séries" avec les tomes manquants). */
export function parseSeriesVolume(title: string): { series: string; volume: number | null } {
  // Le titre vient d'une API externe : espaces en trop possibles des deux côtés, et les regex
  // sont ancrées sur $, donc sans ce trim un "Bleach T01 " n'est pas reconnu du tout.
  const clean = title.trim()
  const m = clean.match(/^(.*?)[\s,:-]*(?:vol\.?|tome|t\.?)\s*0*(\d+)$/i) ?? clean.match(/^(.*?)\s+0*(\d+)$/)
  if (m) {
    // Le séparateur avant le numéro n'est consommé que par la première regex ("Naruto - 7"
    // laisserait sinon "Naruto -", qui formerait une série distincte de "Naruto".
    const series = m[1].trim().replace(/[\s,:-]+$/, '')
    if (series.length > 1) return { series, volume: parseInt(m[2], 10) }
  }
  return { series: clean, volume: null }
}
