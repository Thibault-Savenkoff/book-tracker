/** Nettoyage des requêtes de recherche. Module volontairement sans dépendance ni effet de bord :
 * bookLookup.ts instancie le client Supabase à l'import, ce qui le rend intestable hors navigateur. */

/** Les qualificatifs d'édition ne sont indexés par aucune des sources : "My Hero Academia Tome 34
 * édition collector" ne renvoie rien du tout (vérifié : 0 résultat OpenLibrary), alors que la même
 * requête sans le qualificatif renvoie la série. On les retire pour le repli, sinon un tome marqué
 * collector n'affiche aucune couverture au lieu d'afficher au moins celle de l'édition standard. */
export function stripEditionQualifiers(query: string): string {
  return query
    .replace(/[-–:]?\s*(édition|edition)?\s*(collector|collector's|deluxe|coffret|intégrale|integrale|limitée|limitee)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
