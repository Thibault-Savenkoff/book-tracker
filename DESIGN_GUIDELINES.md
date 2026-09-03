# Directives UI/UX & Design System — BiblioLog

## 1. Direction Artistique ("Modern Dark / Light Editorial")
- Pas de bordures épaisses, jamais.
- Pas de teinte Tailwind hors de la palette autorisée en §2 : `gray`, `zinc`, `blue`, `purple`, `pink`, `orange` et les autres sont interdites. Elles dupliqueraient un rôle déjà couvert et feraient dériver l'interface.
- Le design doit ressembler à Linear, Readwise Reader ou Apple Books (épuré, haute précision).
- Les démos HTML de référence se trouvent dans `/demos` (1-bibliotheque.html et 2-import-et-fiche.html). Respecter scrupuleusement leur structure et leurs classes.

## 2. Palette & Tokens Tailwind (Dark / Light)
- **Fonds & Cartes** :
  - Dark Mode : App Bg `#090A0E` (`bg-app-bg`), Surface `#11131A` (`bg-app-surface`), Card `#161922` (`bg-app-card`).
  - Light Mode : App Bg `#F8F9FA` (`bg-light-bg`), Surface `#FFFFFF` (`bg-light-surface`), Card `#F1F3F7` (`bg-light-card`).
- **Bordures** : Toujours fines et discrètes (`border border-light-border dark:border-app-border`).
- **Rampe neutre** : `slate` est la seule échelle de gris de l'app (texte, placeholders, fonds discrets). `text-slate-400` pour le texte secondaire, `text-slate-900 dark:text-white` pour les titres. Ne jamais introduire `gray` ou `zinc` en parallèle.
- **Couleurs de rôle** : `indigo` pour le primaire et l'interactif (boutons, focus, liens), `red` pour le destructif et les erreurs, `emerald` pour le succès, `amber` pour l'avertissement. Une couleur = un rôle, pas de décoration.
- **Seule exception** : le dégradé de l'avatar (`from-indigo-600 to-violet-500`, `TopNav.svelte`). `violet` n'est autorisé nulle part ailleurs.
- **Codes Couleurs des Genres (Absolus)** :
  - Roman : `text-accent-roman` / `bg-red-500/10` (#EF4444)
  - Manga : `text-accent-manga` / `bg-indigo-500/10` (#6366F1)
  - BD : `text-accent-bd` / `bg-emerald-500/10` (#10B981)
  - Comics : `text-accent-comics` / `bg-amber-500/10` (#F59E0B)

## 3. Typographie & Composants
- **Titres de livres & Collections** : Font Serif (`font-serif`, ex: Instrument Serif ou Newsreader).
- **Métadonnées, ISBN, Pages, Pourcentages, Latences API** : Font Mono (`font-mono`, JetBrains Mono).
- **Interface & Boutons** : Font Sans (`font-sans`, Plus Jakarta Sans ou Inter).
- **Couvertures de livres** : Toujours conserver le ratio éditorial `aspect-[2/3]` avec un `cover-shadow` et coins arrondis `rounded-xl` ou `rounded-md`.

## 4. Règles Svelte 5 (Runes Uniquement)
- NE PAS utiliser la syntaxe Svelte 4 (`export let`, `$: reactiveDeclarations`).
- Utiliser exclusivement `$state()`, `$derived()`, `$props()`, `$effect()`.
- Gérer l'état responsive (Mobile bottom bar vs Desktop sidebar) sans duplication inutile de code.