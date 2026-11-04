import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { LuAlertCircle, LuCheck, LuGift, LuQrCode, LuSmartphone, LuWallet } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { errText, num } from '../lib/format'
import { Brand, Mark } from '../components/Logo'
import { scanUrl } from './CashierPanel'

// Mijozga qaragan ekran (planshet/monitor): kassada yaratilgan QR avtomatik chiqadi
export default function Display() {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const tx = state?.tx

  useEffect(() => {
    let stopped = false
    const poll = async () => {
      const { data, error } = await supabase.rpc('cashier_display')
      if (stopped) return
      if (error) return setError(errText(error))
      setError(''); setState(data)
    }
    poll()
    const t = setInterval(poll, 1500)
    let lock
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => { stopped = true; clearInterval(t); lock?.release?.() }
  }, [])

  const goFull = () => document.documentElement.requestFullscreen?.().catch(() => {})

  return (
    <div className="display" onDoubleClick={goFull}>
      <div className="rays" aria-hidden="true" />
      <header className="display-top">
        <Brand light size={38} />
        <div className="display-cafe">{state?.cafe_name}</div>
      </header>

      {error && <div className="display-center"><div className="alert err"><LuAlertCircle size={18} />{error}</div></div>}

      {!error && !tx && (
        <div className="display-center">
          <Mark size={170} light />
          <h1>Har bir kofedan <span>{Number(state?.cashback_percent || 0)}%</span> cashback</h1>
          <div className="display-steps">
            <div><LuSmartphone size={28} />Coffeegram’da ro‘yxatdan o‘ting</div>
            <div><LuQrCode size={28} />Kassada QR kodni skanerlang</div>
            <div><LuGift size={28} />Bonuslar bilan keyingi kofeni to‘lang</div>
          </div>
        </div>
      )}

      {!error && tx?.status === 'pending' && (
        <div className="display-qr">
          <div className="display-qr-box"><QRCodeSVG value={scanUrl(tx.token)} size={420} level="M" fgColor="#141110" bgColor="#ffffff" includeMargin /></div>
          <div className="display-info">
            <span className="tag type">{tx.type === 'cashback' ? <><LuGift size={13} /> Cashback olish</> : <><LuWallet size={13} /> Balansdan to‘lash</>}</span>
            <h2>Telefoningiz bilan skanerlang</h2>
            {tx.items?.length > 0 && (
              <ul className="display-items">
                {tx.items.map((it) => <li key={it.id}><span>{it.qty} × {it.name}</span><b className="num">{num(it.qty * it.price)}</b></li>)}
              </ul>
            )}
            <div className="display-total"><span>Jami</span><b className="num">{num(tx.amount)} so‘m</b></div>
            {tx.type === 'cashback' && <div className="display-cb"><LuGift size={22} /> Sizga <b>+{num(tx.cashback_amount)} so‘m</b> bonus</div>}
          </div>
        </div>
      )}

      {!error && tx?.status === 'confirmed' && (
        <div className="display-center">
          <div className="result-ico"><LuCheck size={80} strokeWidth={3} /></div>
          <h1>Rahmat{tx.customer_name ? `, ${tx.customer_name}` : ''}!</h1>
          <p className="display-big num">
            {tx.type === 'cashback' ? `+${num(tx.cashback_amount)} so‘m balansingizga tushdi` : `${num(tx.balance_used)} so‘m balansdan to‘landi`}
          </p>
          {tx.balance_after != null && <p className="display-sub">Bonus balans: {num(tx.balance_after)} so‘m</p>}
        </div>
      )}

      <footer className="display-foot">Ikki marta bosing — to‘liq ekran</footer>
    </div>
  )
}
