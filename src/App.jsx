import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import { LuLogOut } from 'react-icons/lu'
import Splash from './components/Splash'
import { Mark } from './components/Logo'
import Login from './pages/Login'
import CashierPanel from './pages/CashierPanel'
import Display from './pages/Display'

// Faqat kassir kira oladi; boshqa rol — "Kirish taqiqlangan"
function CashierOnly({ children }) {
  const { session, profile, ready, signOut } = useAuth()
  if (!ready) return <Splash text="Kassa yuklanmoqda…" />
  if (!session) return <Login />
  if (!profile) return <Splash text="Profil yuklanmoqda…" />
  if (profile.role !== 'cashier') {
    return (
      <div className="splash">
        <Mark size={64} />
        <h2>Kirish taqiqlangan</h2>
        <p>Bu ilova faqat kassirlar uchun. <b>{profile.email || profile.phone}</b> akkaunti kassir emas.</p>
        <button className="btn btn-primary" onClick={signOut}><LuLogOut size={18} /> Boshqa akkaunt bilan kirish</button>
      </div>
    )
  }
  return children
}

export default function App() {
  if (!supabaseConfigured) {
    return <div className="splash"><Mark size={64} /><h2>Supabase ulanmagan</h2><p><code>.env</code> faylini to‘ldiring.</p></div>
  }
  return (
    <Routes>
      <Route path="/" element={<CashierOnly><CashierPanel /></CashierOnly>} />
      <Route path="/display" element={<CashierOnly><Display /></CashierOnly>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
