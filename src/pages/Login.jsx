import { useState } from 'react'
import { LuAlertCircle, LuArrowRight } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { errText } from '../lib/format'
import { Mark } from '../components/Logo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setBusy(false)
    if (error) setError(errText(error))
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="rays" aria-hidden="true" />
        <span className="badge">KASSA</span>
        <Mark size={110} light className="mark" />
        <h1>Coffeegram</h1>
        <p>Kofexona kassirlari uchun</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>Kassaga kirish</h2>
        <label className="field"><span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kassir@coffeegram.uz" autoComplete="username" required />
        </label>
        <label className="field"><span>Parol</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Kuting…' : 'Kirish'} {!busy && <LuArrowRight size={18} />}</button>
        <p className="auth-foot">Login va parolni administrator beradi</p>
      </form>
    </div>
  )
}
