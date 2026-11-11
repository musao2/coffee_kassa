import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  LuAlertCircle, LuArrowRight, LuBan, LuCalculator, LuCheck, LuChevronDown, LuChevronUp, LuClipboardList,
  LuCoffee, LuCreditCard, LuGift, LuLogOut, LuMinus, LuMonitor, LuPlus, LuPrinter, LuQrCode,
  LuPackage, LuReceipt, LuRotateCcw, LuShoppingBag, LuTrash2, LuTrendingUp, LuUsers, LuWallet,
} from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dateTime, errText, num, som } from '../lib/format'
import { Mark } from '../components/Logo'
import ReceiptModal, { printPendingReceipt, printReceipt, scanLink } from '../components/Receipt'
import Stat from '../components/Stat'
import StampCard from '../components/StampCard'
import ReasonModal from '../components/ReasonModal'
import Expenses from './Expenses'
import Report from './Report'
import { ShiftBar, ShiftGate, ShiftPill, ShiftProvider, useShift } from './Shift'

// QR mijoz ilovasiga olib boradi (kassa boshqa manzilda ishlaydi)
export const scanUrl = (token) => scanLink(token)

export default function CashierPanel() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('kassa')

  return (
    <ShiftProvider>
    <div className="kassa">
      <header className="pos-top">
        <Mark size={34} light />
        <div className="cafe">
          <small>{profile.full_name || 'Kassir'}</small>
          <b>{profile.cafe?.name || 'Kofexona biriktirilmagan'}</b>
        </div>
        <ShiftPill />
        <div className="seg dark">
          <button className={tab === 'kassa' ? 'on' : ''} onClick={() => setTab('kassa')} aria-label="Kassa"><LuCalculator size={17} /><span className="hide-sm">Kassa</span></button>
          <button className={tab === 'expense' ? 'on' : ''} onClick={() => setTab('expense')} aria-label="Xarajat"><LuWallet size={17} /><span className="hide-sm">Xarajat</span></button>
          <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')} aria-label="Hisobot"><LuClipboardList size={17} /><span className="hide-sm">Hisobot</span></button>
        </div>
        <a className="icon-btn dark" href="/display" target="_blank" rel="noreferrer" title="Mijozga qaragan QR ekran" aria-label="QR ekran"><LuMonitor size={19} /></a>
        <button className="icon-btn dark" onClick={signOut} title="Chiqish" aria-label="Chiqish"><LuLogOut size={19} /></button>
      </header>
      <main className="pos-main">
        {profile.is_active === false ? (
          <div className="alert err"><LuAlertCircle size={18} />Akkauntingiz bloklangan. Administratorga murojaat qiling.</div>
        ) : tab === 'kassa' ? <ShiftGate><ShiftBar /><Register cafe={profile.cafe} /></ShiftGate> : tab === 'expense' ? <ShiftGate><Expenses /></ShiftGate> : <Report />}
      </main>
    </div>
    </ShiftProvider>
  )
}

function Register({ cafe }) {
  const { profile } = useAuth()
  const shift = useShift()
  const [allProducts, setAllProducts] = useState([])
  const [catRows, setCatRows] = useState(null)
  const [category, setCategory] = useState('Hammasi')
  const [cart, setCart] = useState({})
  const [phase, setPhase] = useState('input') // input | qr | done | cancelled
  const [tx, setTx] = useState(null)
  const [result, setResult] = useState(null)
  const [printingNow, setPrintingNow] = useState(false)
  const [flash, setFlash] = useState(null)
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 6000); return () => clearTimeout(t) }, [flash])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('products').select('*').eq('is_active', true).order('sort').order('name')
      .then(({ data }) => setAllProducts(data || []))
    // admin belgilagan kategoriyalar tartibi (jadval bo'lmasa — mahsulotlardagi tartib)
    supabase.from('categories').select('name, sort, is_active').order('sort').order('name')
      .then(({ data, error }) => setCatRows(error ? [] : data || []))
  }, [])

  // yashirilgan kategoriyalar va ularning mahsulotlari kassada ko'rinmaydi
  const { products, categories } = useMemo(() => {
    const rows = catRows || []
    const hidden = new Set(rows.filter((c) => !c.is_active).map((c) => c.name))
    const order = new Map(rows.map((c, i) => [c.name, i]))
    const list = allProducts
      .filter((p) => !hidden.has(p.category))
      .sort((a, b) => (order.get(a.category) ?? 999) - (order.get(b.category) ?? 999) || a.sort - b.sort || a.name.localeCompare(b.name))
    const names = [...new Set(list.map((p) => p.category))]
    return { products: list, categories: ['Hammasi', ...names] }
  }, [allProducts, catRows])
  const shown = category === 'Hammasi' ? products : products.filter((p) => p.category === category)
  const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }))
  const itemsCount = lines.reduce((s, l) => s + l.qty, 0)
  const stampQty = lines.filter((l) => l.is_stamp).reduce((s, l) => s + l.qty, 0)
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)

  const add = (id, d = 1) => {
    setError('')
    setCart((c) => {
      const q = Math.max(0, Math.min(99, (c[id] || 0) + d))
      const n = { ...c }
      if (q) n[id] = q
      else delete n[id]
      return n
    })
  }

  const generate = async () => {
    if (!lines.length) return setError('Menyudan mahsulot tanlang')
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('create_order', { p_items: lines.map((l) => ({ id: l.id, qty: l.qty })) })
    setBusy(false)
    if (error) { if (/SHIFT_CLOSED/.test(error.message)) shift?.reload(); return setError(errText(error)) }
    setTx(data); setOpen(false); setPhase('qr')
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (phase !== 'qr' || !tx) return
    let stopped = false
    const poll = async () => {
      const { data } = await supabase.rpc('cashier_transaction_status', { p_id: tx.id })
      if (stopped || !data) return
      if (data.status === 'confirmed') { setResult(data); setPhase('done') }
      else if (data.status === 'cancelled') setPhase('cancelled')
    }
    const t = setInterval(poll, 2000)
    return () => { stopped = true; clearInterval(t) }
  }, [phase, tx])

  const cancel = async () => {
    if (tx && phase === 'qr') await supabase.rpc('cancel_transaction', { p_id: tx.id })
    setPhase('input'); setTx(null)
  }
  // "Keyingi buyurtma": pul olindi, chek chiqarilmadi — sotuv sifatida saqlanadi va hisoblanadi.
  // Mijoz keyin QR'ni skanerlasa ham shtampini oladi (summa ikki marta hisoblanmaydi).
  const nextOrder = async () => {
    if (!tx) return reset()
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('cashier_mark_sold', { p_id: tx.id })
    setBusy(false)
    if (error) return setError(errText(error))
    const amount = tx.amount
    reset()
    setFlash({ kind: 'ok', text: `Sotuv saqlandi — chek №${String(data?.receipt_no ?? '').padStart(6, '0')} · ${som(amount)}` })
  }
  // "Yana narsa qo'shish": QR bekor qilinadi, savat saqlanadi — mahsulot qo'shib yangi QR yaratiladi
  const addMore = async () => {
    if (tx) {
      setBusy(true)
      const { data } = await supabase.rpc('cashier_transaction_status', { p_id: tx.id })
      if (data?.status === 'confirmed') { setBusy(false); setResult(data); setPhase('done'); return }
      await supabase.rpc('cancel_transaction', { p_id: tx.id })
      setBusy(false)
    }
    setTx(null); setError(''); setPhase('input')
    setFlash({ kind: 'info', text: 'Buyurtmaga mahsulot qo‘shing, so‘ng yangi QR yarating' })
  }
  const reset = () => { setTx(null); setResult(null); setCart({}); setError(''); setPhase('input'); shift?.reload() }

  // Tugma bosilishi bilan chek printerga ketadi (oraliq oyna yo'q)
  const doPrint = async (fn) => {
    setPrintingNow(true); setError('')
    try { await fn() } catch (e) { setError(e.message) } finally { setPrintingNow(false) }
  }
  const printPending = () => doPrint(() => printPendingReceipt({
    type: 'stamp', status: 'pending', items: tx.items, amount: tx.amount, stamp_qty: tx.stamp_qty, goal: 9,
    confirmed_at: tx.created_at, cafe_name: cafe?.name, cafe_address: cafe?.address, cashier_name: profile.full_name,
  }, scanUrl(tx.token)))

  if (phase === 'qr' && tx) {
    return (
      <div className="qr-stage">
        <div className="qr-card">
          <span className="tag spend"><LuCoffee size={13} /> +{tx.stamp_qty} shtamp</span>
          <div className="qr-box"><QRCodeSVG value={scanUrl(tx.token)} size={260} level="M" fgColor="#141110" bgColor="#ffffff" includeMargin /></div>
          <div className="qr-sum num">{som(tx.amount)}</div>
          <p className="muted small">Agar mijozda bepul kofe bo‘lsa, u skanerlaganda tanlaydi — to‘lov summasi shu yerda chiqadi.</p>
          <p className="waiting"><span className="live-dot" /> Mijoz skanerlashini kutyapmiz</p>
          {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" onClick={printPending} disabled={printingNow}><LuPrinter size={19} /> {printingNow ? 'Chop etilmoqda…' : 'QR chek chiqarish'}</button>
          <div className="qr-actions">
            <button className="btn btn-outline" onClick={addMore} disabled={busy}><LuPlus size={18} /> Yana narsa qo‘shish</button>
            <button className="btn btn-accent" onClick={nextOrder} disabled={busy}>Keyingi buyurtma <LuArrowRight size={18} /></button>
          </div>
          <p className="muted small center">“Keyingi buyurtma” — sotuv saqlanadi va hisobotga kiradi (chek chiqmaydi). Mijoz keyin QR’ni skanerlab shtamp olishi mumkin.</p>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={cancel}><LuBan size={15} /> QR’ni bekor qilish</button>
        </div>
      </div>
    )
  }

  if (phase === 'done' && result) {
    return (
      <div className="qr-stage">
        <div className="qr-card">
          <div className="result-ico"><LuCheck size={44} strokeWidth={3} /></div>
          <h2>Tasdiqlandi!</h2>
          <p className="muted small">Chek №{String(result.receipt_no).padStart(6, '0')}{result.customer_name && <> · {result.customer_name} {result.customer_phone}</>}</p>
          {result.free_used && <div className="alert ok"><LuGift size={18} />Bepul kofe: <b>&nbsp;{result.free_item?.name}</b>&nbsp;(−{som(result.discount)})</div>}
          <div className="done-big num">{som(result.to_pay)} <small>mijozdan oling (naqd / karta)</small></div>
          <div className="muted">Kartochkaga: <b className="pos">+{result.stamps_earned} shtamp</b></div>
          {result.stamps_after != null && (
            <div style={{ width: '100%' }}><StampCard compact stamps={result.stamps_after} free={result.free_after} goal={result.goal} title="Mijoz kartochkasi" /></div>
          )}
          {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" onClick={() => doPrint(() => printReceipt(result.id))} disabled={printingNow}><LuPrinter size={19} /> {printingNow ? 'Chop etilmoqda…' : 'Chek chiqarish'}</button>
          <button className="btn btn-outline btn-block" onClick={reset} autoFocus>Yangi buyurtma <LuArrowRight size={18} /></button>
        </div>
      </div>
    )
  }

  if (phase === 'cancelled') {
    return (
      <div className="qr-stage">
        <div className="qr-card">
          <div className="result-ico muted"><LuBan size={40} /></div>
          <h2>QR bekor qilindi</h2>
          <p className="muted">Buyurtma saqlandi — kerak bo‘lsa yangi QR yarating.</p>
          <button className="btn btn-primary btn-block" onClick={() => { setPhase('input'); setTx(null) }}>Qayta urinish</button>
          <button className="btn btn-ghost btn-block" onClick={reset}>Yangi buyurtma</button>
        </div>
      </div>
    )
  }

  return (
    <div className="register">
      <section className="register-left">
        {flash && (
          <div className={`alert ${flash.kind === 'ok' ? 'ok' : ''} flash`} onClick={() => setFlash(null)}>
            {flash.kind === 'ok' ? <LuCheck size={18} /> : <LuPlus size={18} />}<span className="grow">{flash.text}</span>
          </div>
        )}
        <div className="chips">
          {categories.map((c) => <button key={c} className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>{c}</button>)}
        </div>
        {products.length === 0 ? (
          <div className="empty"><LuClipboardList size={36} />Menyu bo‘sh. Admin panelda mahsulot qo‘shing.</div>
        ) : (
          <div className="menu-grid">
            {shown.map((p) => (
              <button key={p.id} className={`menu-item ${cart[p.id] ? 'in' : ''}`} onClick={() => add(p.id)}>
                {cart[p.id] > 0 && <em>{cart[p.id]}</em>}
                <b>{p.name}</b>
                <span className="row" style={{ justifyContent: 'space-between' }}>
                  <small className="num">{num(p.price)}</small>
                  {p.is_stamp && <LuCoffee size={15} title="Shtamp beradi" style={{ color: 'var(--caramel)' }} />}
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="muted small row" style={{ gap: 6 }}><LuCoffee size={14} style={{ color: 'var(--caramel)' }} /> belgili mahsulotlar kartochkaga shtamp beradi · 9 shtamp = 1 bepul kofe</p>
      </section>

      <aside className={`order ${open ? 'open' : ''}`}>
        <div className="order-head">
          <h3><LuReceipt size={18} /> Buyurtma {itemsCount > 0 && <span className="count">{itemsCount}</span>}</h3>
          <div className="row">
            {lines.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setCart({})}><LuTrash2 size={15} /> Tozalash</button>}
            {lines.length > 0 && (
              <button className="order-toggle" onClick={() => setOpen((o) => !o)} aria-label="Buyurtmani ochish">{open ? <LuChevronDown size={18} /> : <LuChevronUp size={18} />}</button>
            )}
          </div>
        </div>
        <div className="collapse">
          {lines.length === 0 ? <p className="muted small">Mahsulotlarni bosib qo‘shing</p> : (
            <ul className="order-lines">
              {lines.map((l) => (
                <li key={l.id}>
                  <div><b>{l.name}</b><small className="num">{num(l.price)} × {l.qty} = {num(l.price * l.qty)}</small></div>
                  <div className="qty">
                    <button onClick={() => add(l.id, -1)} aria-label="Kamaytirish"><LuMinus size={16} /></button>
                    <span>{l.qty}</span>
                    <button onClick={() => add(l.id, 1)} aria-label="Ko‘paytirish"><LuPlus size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="order-total"><span className="muted">Jami</span><b className="num">{som(total)}</b></div>
        {stampQty > 0 && <div className="order-cb"><LuCoffee size={15} /> Mijoz kartochkasiga: <b>+{stampQty} shtamp</b></div>}
        {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
        <button id="gen-btn" className="btn btn-primary btn-lg btn-block" onClick={generate} disabled={busy || !lines.length}>
          <LuQrCode size={20} /> {busy ? 'Yaratilmoqda…' : 'QR yaratish'}
        </button>
      </aside>
    </div>
  )
}
