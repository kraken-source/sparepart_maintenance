export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
export const km = (n) => (n == null ? '-' : Number(n).toLocaleString('id-ID') + ' km')
export const tanggal = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const ACTIONS = { replace: 'Ganti', repair: 'Perbaikan', inspect: 'Pengecekan' }

/** Ubah '' menjadi null dan string angka menjadi Number untuk field numerik. */
export const toNumberOrNull = (v) => (v === '' || v == null ? null : Number(v))
