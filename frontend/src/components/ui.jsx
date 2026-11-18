/** Komponen UI kecil yang dipakai bersama oleh semua form CRUD. */

export function Modal({ title, onClose, onSubmit, children, footer, wide = false }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      {/* noValidate: pesan validasi selalu dari server (Bahasa Indonesia), bukan tooltip browser */}
      <form className={`modal ${wide ? 'modal-wide' : ''}`} noValidate onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3>{title}</h3>
        {children}
        <div className="actions">{footer}</div>
      </form>
    </div>
  )
}

export function Field({ label, error, hint, children }) {
  return (
    <label className={error ? 'has-error' : ''}>
      <span>{label}</span>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error && <small className="error">{error}</small>}
    </label>
  )
}

/** Tombol standar di footer modal: [Hapus]  ……  [Batal] [Simpan] */
export function FormFooter({ onClose, onDelete, saving, deleting }) {
  return (
    <>
      {onDelete && (
        <button type="button" className="danger" disabled={deleting} onClick={onDelete}>
          Hapus
        </button>
      )}
      <span style={{ flex: 1 }} />
      <button type="button" onClick={onClose}>Batal</button>
      <button type="submit" className="primary" disabled={saving}>
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </>
  )
}
