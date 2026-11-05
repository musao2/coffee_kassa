import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { LuAlertCircle, LuCheck, LuCoffee, LuGift, LuQrCode, LuSmartphone } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { errText, num } from '../lib/format'
import { Brand, Mark } from '../components/Logo'
import { scanUrl } from './CashierPanel'
import StampCard from '../components/StampCard'

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
          <h1><span>{state?.goal || 9}</span> ta kofe oling — <span>10-chisi bepul</span></h1>
          <div className="display-steps">
            <div><LuSmartphone size={28} />Coffeegram’da ro‘yxatdan o‘ting</div>
            <div><LuQrCode size={28} />Har xaridda QR’ni skanerlang — har kofe = 1 shtamp</div>
            <div><LuGift size={28} />9 shtamp yig‘ilsa, keyingi kofe bepul</div>
          </div>
        </div>
      )}

      {!error && tx?.status === 'pending' && (
        <div className="display-qr">
          <div className="display-qr-box"><QRCodeSVG value={scanUrl(tx.token)} size={420} level="M" fgColor="#141110" bgColor="#ffffff" includeMargin /></div>
          <div className="display-info">
            <span className="tag type"><LuCoffee size={13} /> Kofe kartochkasi</span>
            <h2>Telefoningiz bilan skanerlang</h2>
            {tx.items?.length > 0 && (
              <ul className="display-items">
                {tx.items.map((it) => <li key={it.id}><span>{it.qty} × {it.name}</span><b className="num">{num(it.qty * it.price)}</b></li>)}
              </ul>
            )}
            <div className="display-total"><span>Jami</span><b className="num">{num(tx.amount)} so‘m</b></div>
            {tx.stamp_qty > 0 && <div className="display-cb"><LuCoffee size={22} /> Kartochkangizga <b>+{tx.stamp_qty} shtamp</b></div>}
            <p className="display-sub">Bepul kofeingiz bo‘lsa — telefonda “Bepul kofeni ishlatish” ni tanlang</p>
          </div>
        </div>
      )}

      {!error && tx?.status === 'confirmed' && (
        <div className="display-center">
          <div className="result-ico"><LuCheck size={80} strokeWidth={3} /></div>
          <h1>Rahmat{tx.customer_name ? `, ${tx.customer_name}` : ''}!</h1>
          <p className="display-big num">{tx.free_used ? 'Bepul kofe ishlatildi!' : `+${tx.stamps_earned} shtamp kartochkangizga`}</p>
          {tx.stamps_after != null && (
            <div style={{ width: 'min(560px, 100%)' }}><StampCard stamps={tx.stamps_after} free={tx.free_after} goal={state?.goal || 9} /></div>
          )}
          <p className="display-sub">To‘lov: {num(tx.to_pay)} so‘m</p>
        </div>
      )}

      <footer className="display-foot">Ikki marta bosing — to‘liq ekran</footer>
    </div>
  )
}
