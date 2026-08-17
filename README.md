# BiblioLog

PWA perso pour suivre romans/BD/mangas lus (note + avis, pas de social). Installable sur iPhone via "Ajouter à l'écran d'accueil" (Safari), tourne aussi tel quel sur PC.

## Setup

1. Créer un projet gratuit sur [supabase.com](https://supabase.com)
2. Dans l'éditeur SQL du projet, exécuter `supabase/schema.sql`
3. Activer l'auth par email (magic link) : Authentication → Providers → Email
4. Copier `.env.example` en `.env` et remplir avec l'URL + clé anon du projet (Settings → API)
5. `VITE_GOOGLE_BOOKS_API_KEY` optionnelle — sans clé, le fallback Google Books fonctionne quand même (quota plus bas)
6. `npm install && npm run dev`

## Déploiement

Push sur un repo git, connecter le repo à [Vercel](https://vercel.com) (tier gratuit), ajouter les mêmes variables d'env dans les Project Settings Vercel. Framework preset : Vite.

Une fois déployé, ouvrir l'URL sur iPhone dans Safari → bouton Partager → "Sur l'écran d'accueil".

## Scan code-barre

Nécessite HTTPS (le déploiement Vercel l'a par défaut ; en local, `npm run dev` sur `localhost` fonctionne aussi car les navigateurs autorisent la caméra sur localhost).
