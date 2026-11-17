import { create } from 'zustand'

const KEY = 'sm_token'

const readToken = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** true bila user yang login adalah admin. Selama data user belum dimuat → false (aman: sembunyikan aksi admin). */
export const useIsAdmin = () => useAuth((s) => s.user?.role === 'admin')

export const ROLES = { admin: 'Admin', user: 'User' }

/** State login: token Sanctum + data user. Token disimpan di localStorage agar tetap login setelah refresh. */
export const useAuth = create((set) => ({
  token: readToken(),
  user: null,

  setSession: (token, user) => {
    try {
      localStorage.setItem(KEY, token)
    } catch {
      /* mode privat: login tetap jalan selama tab terbuka */
    }
    set({ token, user })
  },
  setUser: (user) => set({ user }),
  clear: () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* abaikan */
    }
    set({ token: null, user: null })
  },
}))
