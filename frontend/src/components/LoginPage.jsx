import { useEffect, useState } from 'react'
import { preload3D } from '../lazy3d'
import { useMutation } from '@tanstack/react-query'
import { api, validationErrors } from '../api'
import { useAuth } from '../auth'

export default function LoginPage() {
  const setSession = useAuth((s) => s.setSession)
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})

  // Unduh paket 3D di latar belakang selagi user mengisi login.
  useEffect(() => preload3D(), [])

  const login = useMutation({
    mutationFn: api.login,
    onSuccess: ({ token, user }) => setSession(token, user),
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    login.mutate({ ...form, device: navigator.userAgent.slice(0, 100) })
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="center-screen">
      <form className="login-card" noValidate onSubmit={submit}>
        <h2>Sparepart Maintenance</h2>
        <p className="muted">Masuk untuk melanjutkan</p>

        {errors._general && <p className="error">{errors._general}</p>}

        <label>
          <span>Email</span>
          <input type="email" autoComplete="username" value={form.email} onChange={set('email')} autoFocus required />
          {errors.email && <small className="error">{errors.email}</small>}
        </label>
        <label>
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={form.password} onChange={set('password')} required />
          {errors.password && <small className="error">{errors.password}</small>}
        </label>

        <button type="submit" className="primary" disabled={login.isPending}>
          {login.isPending ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
