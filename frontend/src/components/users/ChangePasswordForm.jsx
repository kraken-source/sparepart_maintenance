import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, validationErrors } from '../../api'
import { Field, FormFooter, Modal } from '../ui'

/** Ganti password sendiri (semua pengguna). */
export default function ChangePasswordForm({ onClose }) {
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: api.changePassword,
    onSuccess: () => setDone(true),
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    save.mutate(form)
  }

  if (done) {
    return (
      <Modal title="Ganti password" onClose={onClose} onSubmit={(e) => { e.preventDefault(); onClose() }}
        footer={<button type="submit" className="primary">Tutup</button>}>
        <p>✅ Password berhasil diganti. Perangkat lain yang memakai akun ini sudah dikeluarkan.</p>
      </Modal>
    )
  }

  return (
    <Modal title="Ganti password" onClose={onClose} onSubmit={submit} footer={<FormFooter onClose={onClose} saving={save.isPending} />}>
      {errors._general && <p className="error">{errors._general}</p>}
      <Field label="Password saat ini" error={errors.current_password}>
        <input type="password" value={form.current_password} onChange={set('current_password')} autoComplete="current-password" autoFocus />
      </Field>
      <Field label="Password baru" error={errors.password} hint="Minimal 8 karakter.">
        <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
      </Field>
      <Field label="Ulangi password baru" error={errors.password_confirmation}>
        <input type="password" value={form.password_confirmation} onChange={set('password_confirmation')} autoComplete="new-password" />
      </Field>
    </Modal>
  )
}
