import { create } from 'zustand'

/**
 * Tema tampilan: 'light' | 'dark'. Pilihan user disimpan di localStorage (kenyamanan per browser).
 * Bila belum pernah memilih, tema mengikuti pengaturan sistem operasi dan ikut berubah bila sistem berubah.
 * Atribut <html data-theme="…"> juga sudah dipasang lebih awal oleh skrip di index.html agar tidak berkedip.
 */
const KEY = 'sm_theme'
const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null
const systemTheme = () => (media && !media.matches ? 'light' : 'dark')

function readSaved() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

const saved = readSaved()
const initial = saved ?? systemTheme()
apply(initial)

export const useTheme = create((set, get) => ({
  theme: initial,
  explicit: saved !== null, // true bila user pernah memilih sendiri

  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* mode privat: tetap berganti selama tab terbuka */
    }
    apply(next)
    set({ theme: next, explicit: true })
  },
}))

// Ikuti perubahan tema sistem selama user belum memilih sendiri.
media?.addEventListener?.('change', () => {
  if (useTheme.getState().explicit) return
  const t = systemTheme()
  apply(t)
  useTheme.setState({ theme: t })
})
