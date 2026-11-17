import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../api'
import { STATUS, useUi } from '../store'
import { Icon } from './Sidebar'

const MAX_ITEMS = 4

/** "baru saja", "5 menit lalu", "kemarin", atau tanggal. */
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'baru saja'
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  if (diff < 172800) return 'kemarin'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Lonceng notifikasi pengingat jatuh tempo. Diperbarui tiap menit.
 * Klik notifikasi → buka dashboard kendaraan & pilih part yang paling mendesak.
 */
export default function NotificationBell({ onOpenDashboard }) {
  const qc = useQueryClient()
  const setVehicle = useUi((s) => s.setVehicle)
  const selectMesh = useUi((s) => s.selectMesh)
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState(null)
  const box = useRef(null)

  const list = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: 60_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: refresh })
  const markAll = useMutation({ mutationFn: api.markAllNotificationsRead, onSuccess: refresh })
  const checkNow = useMutation({
    mutationFn: api.checkDueNow,
    onSuccess: (r) => {
      setInfo(r.vehicles_notified ? `${r.vehicles_notified} notifikasi baru` : 'Tidak ada pengingat baru')
      refresh()
    },
    onError: (err) => setInfo(errorMessage(err)),
  })

  // Tutup saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openNotification = (n) => {
    if (!n.read_at) markRead.mutate(n.id)
    setVehicle(n.data.vehicle_id)
    if (n.data.items?.[0]) selectMesh(n.data.items[0].mesh_name)
    onOpenDashboard()
    setOpen(false)
  }

  const unread = list.data?.unread_count ?? 0
  const items = list.data?.data ?? []

  return (
    <div className="bell" ref={box}>
      <button
        className={`bell-btn ${open ? 'active' : ''}`}
        onClick={() => { setOpen((o) => !o); setInfo(null) }}
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
        title="Notifikasi"
      >
        <Icon name="bell" />
        {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <strong>Notifikasi</strong>
            <div className="bell-actions">
              <button className="link" disabled={checkNow.isPending} onClick={() => checkNow.mutate()}>
                {checkNow.isPending ? 'Memeriksa…' : 'Periksa sekarang'}
              </button>
              {unread > 0 && (
                <button className="link" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
                  Tandai semua dibaca
                </button>
              )}
            </div>
          </div>
          {info && <div className="bell-info">{info}</div>}

          <ul className="bell-list">
            {items.map((n) => {
              const d = n.data
              const extra = (d.items?.length ?? 0) - MAX_ITEMS
              return (
                <li key={n.id} className={n.read_at ? '' : 'unread'} onClick={() => openNotification(n)}>
                  <i style={{ background: STATUS[d.level]?.color }} className={d.level === 'overdue' && !n.read_at ? 'blink' : ''} />
                  <div className="bell-body">
                    <div className="bell-title">{d.title}</div>
                    <div className="muted bell-vehicle">{d.vehicle_name}</div>
                    <ul className="bell-items">
                      {d.items?.slice(0, MAX_ITEMS).map((it) => (
                        <li key={it.part_id}>
                          <span style={{ color: STATUS[it.status]?.color }}>●</span> {it.name}
                          {it.reminder && <em> (pengingat ulang)</em>}
                          <span className="muted"> · {it.detail}</span>
                        </li>
                      ))}
                      {extra > 0 && <li className="muted">+{extra} part lainnya</li>}
                    </ul>
                    <small className="muted">{timeAgo(n.created_at)}</small>
                  </div>
                </li>
              )
            })}
            {list.isLoading && <li className="bell-empty muted">Memuat…</li>}
            {list.data && items.length === 0 && (
              <li className="bell-empty muted">Belum ada notifikasi. Pemeriksaan otomatis berjalan setiap hari pukul 07.00.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
