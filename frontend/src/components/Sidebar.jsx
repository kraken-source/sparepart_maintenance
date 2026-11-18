import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { ROLES, useAuth } from '../auth'
import ChangePasswordForm from './users/ChangePasswordForm'

/** Ikon garis sederhana (inline SVG, tanpa library). */
const ICONS = {
  dashboard: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 0v18M3 7.5l9 4.5 9-4.5',
  records: 'M9 4h6m-6 0a2 2 0 0 0-2 2v0H5v15h14V6h-2v0a2 2 0 0 0-2-2M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M8 11h8M8 15h5',
  vehicles: 'M5 16v3m14-3v3M3 16h18v-4l-2-5H5l-2 5v4Zm0-4h18M7 14h.01M17 14h.01',
  parts: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3-2.1-.7a6 6 0 0 0-.6-1.5l1-2-1.4-1.4-2 1a6 6 0 0 0-1.5-.6L12.7 4h-1.4l-.7 2.1a6 6 0 0 0-1.5.6l-2-1-1.4 1.4 1 2a6 6 0 0 0-.6 1.5L4 11.3v1.4l2.1.7a6 6 0 0 0 .6 1.5l-1 2 1.4 1.4 2-1a6 6 0 0 0 1.5.6l.7 2.1h1.4l.7-2.1a6 6 0 0 0 1.5-.6l2 1 1.4-1.4-1-2a6 6 0 0 0 .6-1.5L20 12.7Z',
  logout: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h10',
  reports: 'M4 20h16M7 16v-4m5 4V8m5 8v-6',
  fuel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8h2a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V8l-3-3',
  fuelTypes: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  models3d: 'M4 5h16v14H4V5Zm0 10 4.5-4.5 4 4 2.5-2.5 5 5M15 9.5h.01',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 8v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  key: 'M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.7 5.7L11 17H9v2H7v2H3v-3.6l6.3-6.3A6 6 0 1 1 21 9Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-14v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  bell:'M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9Zm4.3 11a2 2 0 0 0 3.4 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
}

export function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

/**
 * Menu kiri. Desktop: selalu tampil. Tablet: ikon saja. HP: laci (drawer) yang dibuka tombol menu
 * di topbar dan tertutup saat memilih menu, klik di luar, atau tekan Escape.
 */
export default function Sidebar({ groups, active, onSelect, open = false, onClose = () => {} }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
    {open && <div className="nav-backdrop" onClick={onClose} aria-hidden="true" />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <span className="logo">SM</span>
        <span className="label">Sparepart<br />Maintenance</span>
      </div>

      <nav className="sidebar-nav">
        {groups.map((g) => (
          <div key={g.title} className="nav-group">
            <div className="nav-title label">{g.title}</div>
            {g.items.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${active === item.key ? 'active' : ''}`}
                onClick={() => onSelect(item.key)}
                title={item.label}
              >
                <Icon name={item.key} />
                <span className="label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <UserBox />
    </aside>
    </>
  )
}

function UserBox() {
  const user = useAuth((s) => s.user)
  const setUser = useAuth((s) => s.setUser)
  const clear = useAuth((s) => s.clear)

  // Setelah refresh halaman hanya token yang tersimpan; ambil data user-nya.
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: !user })
  useEffect(() => {
    if (me.data) setUser(me.data)
  }, [me.data, setUser])

  const [changingPassword, setChangingPassword] = useState(false)

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      clear()
    }
  }

  return (
    <div className="sidebar-user">
      <span className="avatar" title={user?.email}>{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
      <span className="label user-name" title={user?.email}>
        {user?.name ?? '…'}
        <small className="muted">{user ? ROLES[user.role] ?? user.role : ''}</small>
      </span>
      <button className="nav-item logout" onClick={() => setChangingPassword(true)} title="Ganti password">
        <Icon name="key" />
      </button>
      <button className="nav-item logout" onClick={logout} title="Keluar">
        <Icon name="logout" />
      </button>
      {changingPassword && <ChangePasswordForm onClose={() => setChangingPassword(false)} />}
    </div>
  )
}
