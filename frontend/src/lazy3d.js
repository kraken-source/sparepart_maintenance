import { Component, createElement, lazy } from 'react'

/**
 * Viewer 3D (three.js + react-three-fiber, ±800 KB) dimuat terpisah, hanya untuk Dashboard.
 * Halaman lain (login, catatan, laporan, …) tidak perlu mengunduhnya.
 */
const load = () => import('./components/VehicleViewer')

export const VehicleViewer = lazy(load)

/**
 * Penahan error untuk viewer 3D. Bila paket 3D gagal dimuat (koneksi putus, atau versi aplikasi
 * baru sudah di-deploy sehingga file lama tidak ada), hanya area 3D yang menampilkan pesan –
 * bagian dashboard lain tetap berfungsi. Muat ulang halaman mengambil versi terbaru.
 */
export class Viewer3DBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('Viewer 3D gagal dimuat:', error?.message)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return createElement(
      'div',
      { className: 'viewer viewer-loading', role: 'alert' },
      createElement(
        'div',
        { className: 'viewer-error' },
        createElement('strong', null, 'Model 3D gagal dimuat'),
        createElement('span', { className: 'muted' }, 'Periksa koneksi, lalu muat ulang halaman.'),
        createElement('button', { className: 'primary', onClick: () => window.location.reload() }, 'Muat ulang'),
      ),
    )
  }
}

/**
 * Mulai unduh paket 3D di latar belakang saat browser senggang (mis. ketika user mengetik di
 * halaman login), sehingga Dashboard tetap terbuka cepat. Aman dipanggil berkali-kali.
 */
let started = false
export function preload3D() {
  if (started) return
  started = true
  const run = () => load().catch(() => { started = false }) // gagal (offline) → boleh dicoba lagi
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1500)
}
