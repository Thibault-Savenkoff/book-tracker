import { writable } from 'svelte/store'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const session = writable<Session | null>(null)
export const authLoading = writable(true)
export const passwordRecovery = writable(false)
/** Supabase renvoie les échecs de lien (magic link ou reset) dans le fragment d'URL, pas dans
 * une réponse : sans le lire, un lien expiré affiche un écran de login muet. */
export const authLinkError = writable<string | null>(null)

const AUTH_LINK_ERRORS: Record<string, string> = {
  otp_expired: 'Ce lien a expiré ou a déjà été utilisé. Demande un nouveau lien.',
  access_denied: "Ce lien n'est plus valide. Demande un nouveau lien.",
}

function readAuthLinkError() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  if (!hash) return
  const params = new URLSearchParams(hash)
  const code = params.get('error_code')
  const error = params.get('error')
  if (!code && !error) return
  authLinkError.set(AUTH_LINK_ERRORS[code ?? ''] ?? AUTH_LINK_ERRORS[error ?? ''] ?? params.get('error_description') ?? 'Lien invalide.')
  // Nettoyer le fragment : sans ça, un rechargement réaffiche l'erreur indéfiniment.
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
readAuthLinkError()

supabase.auth.getSession().then(({ data }) => {
  session.set(data.session)
  authLoading.set(false)
})

supabase.auth.onAuthStateChange((event, newSession) => {
  session.set(newSession)
  if (event === 'PASSWORD_RECOVERY') passwordRecovery.set(true)
})
