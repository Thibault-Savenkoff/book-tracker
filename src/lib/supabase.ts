import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anonKey)

export type Book = {
  id: string
  isbn: string | null
  title: string
  authors: string[]
  publisher: string | null
  series: string | null
  category: string
  cover_url: string | null
  is_collector_edition: boolean
  rating: number | null
  review: string | null
  date_added: string
  date_read: string | null
  status: 'wishlist' | 'reading' | 'read' | 'abandoned'
  pages: number | null
  pages_read: number
}

export type Quote = {
  id: string
  book_id: string
  text: string
  page: number | null
  created_at: string
}
