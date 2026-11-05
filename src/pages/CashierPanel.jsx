import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  LuAlertCircle, LuArrowRight, LuBan, LuCalculator, LuCheck, LuChevronDown, LuChevronUp, LuClipboardList,
  LuCoffee, LuCreditCard, LuGift, LuLogOut, LuMinus, LuMonitor, LuPlus, LuPrinter, LuQrCode,
  LuReceipt, LuRotateCcw, LuTrash2, LuTrendingUp, LuUsers, LuWallet,
} from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dateTime, errText, num, som } from '../lib/format'
import { Mark } from '../components/Logo'
import ReceiptModal, { CUSTOMER_URL, printPendingReceipt, printReceipt } from '../components/Receipt'
import Stat from '../components/Stat'
import StampCard from '../components/StampCard'
import ReasonModal from '../components/ReasonModal'
import Expenses from './Expenses'

// QR mijoz ilovasiga olib boradi (kassa boshqa manzilda ishlaydi)
export const scanUrl = (token) => `${CUSTOMER_URL}/scan?t=${token}`

export default function CashierPanel() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('kassa')

  return (
    <div className="kassa">
      <header className="pos-top">
        <Mark size={34} light />
        <div className="cafe">
          <small>{profile.full_name || 'Kassir'}</small>
          <b>{profile.cafe?.name || 'Kofexona biriktirilmagan'}</b>
        </div>
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
        ) : tab === 'kassa' ? <Register cafe={profile.cafe} /> : tab === 'expense' ? <Expenses /> : <Report />}
      </main>
    </div>
  )
}

function Register({ cafe }) {
  const { profile } = useAuth()
  const [allProducts, setAllProducts] = useState([])
  const [catRows, setCatRows] = useState(null)
  const [category, setCategory] = useState('Hammasi')
  const [cart, setCart] = useState({})
  const [phase, setPhase] = useState('input') // input | qr | done | cancelled
  const [tx, setTx] = useState(null)
  const [result, setResult] = useState(null)
  const [printingNow, setPrintingNow] = useState(false)
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
    if (error) return setError(errText(error))
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
  const nextOrder = async () => {
    if (tx) await supabase.rpc('cashier_hide_display', { p_id: tx.id })
    reset()
  }
  const reset = () => { setTx(null); setResult(null); setCart({}); setError(''); setPhase('input') }

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
          <button className="btn btn-outline btn-block" onClick={nextOrder}>Keyingi buyurtma <LuArrowRight size={18} /></button>
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

function Report() {
  const [days, setDays] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [receiptId, setReceiptId] = useState(null)
  const [voidTx, setVoidTx] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setData(null); setError('')
    supabase.rpc('cashier_report', { p_days: days }).then(({ data, error }) => (error ? setError(errText(error)) : setData(data)))
  }, [days, reload])

  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString()
  const doVoid = async (note) => {
    const { error } = await supabase.rpc('cashier_reverse_transaction', { p_id: voidTx.id, p_note: note })
    if (error) throw new Error(errText(error))
    setVoidTx(null); setReceiptId(null); setReload((x) => x + 1)
  }

  const s = data?.stats
  const v = (x, f = num) => (s ? f(x) : '…')
  return (
    <div className="report">
      <div className="report-head">
        <h2>Hisobot</h2>
        <div className="seg">
          {[[1, 'Bugun'], [7, '7 kun'], [30, '30 kun']].map(([d, l]) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>)}
        </div>
      </div>
      {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
      <div className="stats">
        <Stat icon={LuTrendingUp} label="Tushum (to‘langan)" value={v(s?.total_paid, som)} dark wide />
        <Stat icon={LuReceipt} label="Cheklar" value={v(s?.total_count)} />
        <Stat icon={LuCoffee} label="Sotilgan kofe" value={v(s?.coffees)} />
        <Stat icon={LuGift} label="Bepul berilgan" value={v(s?.free_given)} hint={s ? `−${som(s.discount)}` : ''} />
        <Stat icon={LuUsers} label="Mijozlar" value={v(s?.unique_customers)} />
      </div>

      <h3 className="section-title">So‘nggi cheklar</h3>
      {data && data.recent.length === 0 && <div className="empty"><LuReceipt size={36} />Bu davrda amallar yo‘q</div>}
      {data && data.recent.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Chek №</th><th>Vaqt</th><th>Mijoz</th><th>Buyurtma</th><th className="r">To‘lov</th><th className="r">Shtamp</th><th /></tr></thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} onClick={() => setReceiptId(r.id)} className={`click ${r.status === 'reversed' ? 'dim' : ''}`}>
                  <td className="primary" data-label="Chek №">№{r.receipt_no} {r.free_used > 0 && <span className="tag amber"><LuGift size={12} /> bepul</span>}</td>
                  <td data-label="Vaqt">{dateTime(r.confirmed_at)}</td>
                  <td data-label="Mijoz">{r.customer_name || '—'}</td>
                  <td data-label="Buyurtma">{(r.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ') || '—'}</td>
                  <td data-label="To‘lov" className="r num">{num(r.amount - (r.discount || 0))}</td>
                  <td data-label="Shtamp" className="r num pos">{r.type === 'stamp' ? `+${r.stamps_earned}` : '—'}</td>
                  <td className="acts" onClick={(e) => e.stopPropagation()}><div>
                    {r.status === 'reversed' ? <span className="tag reversed">bekor qilingan</span>
                      : r.type === 'stamp' && isToday(r.confirmed_at) && (
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)' }} onClick={() => setVoidTx(r)}><LuRotateCcw size={14} /> Xato — bekor qilish</button>
                      )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {receiptId && (
        <ReceiptModal id={receiptId} onClose={() => setReceiptId(null)}
          actions={(r) => r.status === 'confirmed' && r.type === 'stamp' && isToday(r.confirmed_at) && (
            <button className="btn btn-danger" onClick={() => setVoidTx(r)}><LuRotateCcw size={17} /> Xato — bekor qilish</button>
          )} />
      )}
      {voidTx && (
        <ReasonModal
          title={`Chek №${voidTx.receipt_no} ni bekor qilish`}
          text="Chek “xato” deb belgilanadi, mijozning shtamplari (va ishlatilgan bepul kofe) qaytariladi. Bu admin panelda ko‘rinadi."
          label="Nima uchun xato? (majburiy)"
          placeholder="Masalan: noto‘g‘ri mahsulot tanlandi, 2 emas 1 ta edi"
          confirmText="Chekni bekor qilish"
          danger
          onConfirm={doVoid}
          onClose={() => setVoidTx(null)}
        />
      )}
    </div>
  )
}
