import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, validationErrors } from '../../api'
import { ROLES, useAuth } from '../../auth'
import { Field, FormFooter, Modal } from '../ui'

/** Tambah / edit pengguna (khusus admin). */
export default function UserForm({ user, onClose }) {
  const qc = useQueryClient()
  const me = useAuth((s) => s.user)
  const isEdit = !!user?.id
  const isSelf = isEdit && me?.id === user.id

  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'user',
    is_active: user?.is_active ?? true,
    password: '',
  })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const done = () => {
    qc.invalidateQueries({ queryKey: ['users'] })
    onClose()
  }
  const save = useMutation({
    mutationFn: (p) => (isEdit ? api.updateUser(user.id, p) : api.createUser(p)),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteUser(user.id),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    const payload = { ...form }
    if (isEdit && !payload.password) delete payload.password
    save.mutate(payload)
  }

  return (
    <Modal
      title={isEdit ? `Edit pengguna: ${user.name}` : 'Tambah pengguna'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <FormFooter
          onClose={onClose}
          saving={save.isPending}
          deleting={remove.isPending}
          onDelete={isEdit && !isSelf ? () => confirm(`Hapus pengguna ${user.name}? Tindakan ini tidak bisa dibatalkan.`) && remove.mutate() : null}
        />
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="grid">
        <Field label="Nama" error={errors.name}>
          <input value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="off" />
        </Field>
        <Field
          label="Peran"
          error={errors.role}
          hint={isSelf ? 'Anda tidak bisa mengubah peran akun sendiri.' : 'Admin: kelola master data, pengguna, dan hapus catatan.'}
        >
          <select value={form.role} onChange={set('role')} disabled={isSelf}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field
          label={isEdit ? 'Reset password (opsional)' : 'Password'}
          error={errors.password}
          hint={isEdit ? 'Kosongkan bila tidak diubah. Bila diisi, pengguna keluar dari semua perangkat.' : 'Minimal 8 karakter.'}
        >
          <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
      </div>
      {isEdit && (
        <label className={`check ${errors.is_active ? 'has-error' : ''}`}>
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} disabled={isSelf} />
          <span>Akun aktif</span>
          {!form.is_active && <small className="warn">Pengguna nonaktif tidak bisa login dan langsung dikeluarkan dari semua perangkat.</small>}
          {errors.is_active && <small className="error">{errors.is_active}</small>}
        </label>
      )}
    </Modal>
  )
}
