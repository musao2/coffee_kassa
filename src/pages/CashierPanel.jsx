import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  LuAlertCircle, LuArrowRight, LuBan, LuCalculator, LuCheck, LuChevronDown, LuChevronUp, LuClipboardList,
  LuCoffee, LuCreditCard, LuDelete, LuGift, LuLogOut, LuMinus, LuMonitor, LuPlus, LuPrinter, LuQrCode,
  LuReceipt, LuTrash2, LuTrendingUp, LuUsers, LuWallet,
} from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dateTime, errText, num, som } from '../lib/format'
import { Mark } from '../components/Logo'
import ReceiptModal, { CUSTOMER_URL, PendingReceiptModal } from '../components/Receipt'
import Stat from '../components/Stat'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del']

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
          <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')} aria-label="Hisobot"><LuClipboardList size={17} /><span className="hide-sm">Hisobot</span></button>
        </div>
        <a className="icon-btn dark" href="/display" target="_blank" rel="noreferrer" title="Mijozga qaragan QR ekran" aria-label="QR ekran"><LuMonitor size={19} /></a>
        <button className="icon-btn dark" onClick={signOut} title="Chiqish" aria-label="Chiqish"><LuLogOut size={19} /></button>
      </header>
      <main className="pos-main">
        {profile.is_active === false ? (
          <div className="alert err"><LuAlertCircle size={18} />Akkauntingiz bloklangan. Administratorga murojaat qiling.</div>
        ) : tab === 'kassa' ? <Register cafe={profile.cafe} /> : <Report />}
      </main>
    </div>
  )
}

function Register({ cafe }) {
  const { profile } = useAuth()
  const [mode, setMode] = useState('cashback')
  const [input, setInput] = useState('menu')
  const [products, setProducts] = useState([])
  const [category, setCategory] = useState('Hammasi')
  const [cart, setCart] = useState({})
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState('input') // input | qr | done | cancelled
  const [tx, setTx] = useState(null)
  const [result, setResult] = useState(null)
  const [receiptId, setReceiptId] = useState(null)
  const [printPending, setPrintPending] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const percent = Number(cafe?.cashback_percent || 0)

  useEffect(() => {
    supabase.from('products').select('*').eq('is_active', true).order('sort').order('name')
      .then(({ data }) => setProducts(data || []))
  }, [])

  const categories = useMemo(() => ['Hammasi', ...new Set(products.map((p) => p.category))], [products])
  const shown = category === 'Hammasi' ? products : products.filter((p) => p.category === category)
  const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }))
  const itemsCount = lines.reduce((s, l) => s + l.qty, 0)
  const total = input === 'menu' ? lines.reduce((s, l) => s + l.price * l.qty, 0) : parseInt(amount || '0', 10)

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
  const press = (k) => { setError(''); setAmount((a) => (k === 'del' ? a.slice(0, -1) : (a + k).replace(/^0+/, '').slice(0, 8))) }

  useEffect(() => {
    if (phase !== 'input' || input !== 'sum') return
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') document.getElementById('gen-btn')?.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, input])

  const generate = async () => {
    if (!total) return setError(input === 'menu' ? 'Menyudan mahsulot tanlang' : 'Summani kiriting')
    setBusy(true); setError('')
    const p_items = input === 'menu' ? lines.map((l) => ({ id: l.id, qty: l.qty })) : []
    const { data, error } = await supabase.rpc('create_transaction', { p_amount: total, p_type: mode, p_items })
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
  const reset = () => { setTx(null); setResult(null); setAmount(''); setCart({}); setError(''); setPhase('input') }

  if (phase === 'qr' && tx) {
    return (
      <div className="qr-stage">
        <div className="qr-card">
          <span className={`tag ${tx.type}`}>{tx.type === 'cashback' ? <><LuGift size={13} /> Cashback berish</> : <><LuWallet size={13} /> Balansdan to‘lov</>}</span>
          <div className="qr-box"><QRCodeSVG value={scanUrl(tx.token)} size={260} level="M" fgColor="#141110" bgColor="#ffffff" includeMargin /></div>
          <div className="qr-sum num">{som(tx.amount)}</div>
          {tx.type === 'cashback' && <div className="muted">Mijozga: <b className="pos">+{som(tx.cashback_amount)}</b></div>}
          <p className="waiting"><span className="live-dot" /> Mijoz skanerlashini kutyapmiz · vaqt cheklanmagan</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setPrintPending(true)}><LuPrinter size={19} /> QR chek chiqarish</button>
          <button className="btn btn-outline btn-block" onClick={nextOrder}>Keyingi buyurtma <LuArrowRight size={18} /></button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={cancel}><LuBan size={15} /> QR’ni bekor qilish</button>
        </div>
        {printPending && (
          <PendingReceiptModal
            qrValue={scanUrl(tx.token)}
            onClose={() => setPrintPending(false)}
            r={{
              type: tx.type, status: 'pending', items: tx.items, amount: tx.amount, cashback_amount: tx.cashback_amount,
              balance_used: 0, paid_cash: tx.amount, confirmed_at: tx.created_at, cafe_name: cafe?.name,
              cafe_address: cafe?.address, cashier_name: profile.full_name,
            }}
          />
        )}
      </div>
    )
  }

  if (phase === 'done' && result) {
    return (
      <div className="qr-stage">
        <div className="qr-card">
          <div className="result-ico"><LuCheck size={44} strokeWidth={3} /></div>
          <h2>Muvaffaqiyatli!</h2>
          <p className="muted small">Chek №{String(result.receipt_no).padStart(6, '0')}{result.customer_name && <> · {result.customer_name} {result.customer_phone}</>}</p>
          {result.type === 'cashback' ? (
            <div className="done-big num">+{som(result.cashback_amount)} <small>mijoz balansiga</small></div>
          ) : (
            <>
              <div className="done-big num">{som(result.balance_used)} <small>balansdan yechildi</small></div>
              {result.remaining > 0
                ? <div className="alert warn"><LuCreditCard size={18} />Mijozdan yana <b>&nbsp;{som(result.remaining)}&nbsp;</b> naqd/karta bilan oling</div>
                : <div className="alert ok"><LuCheck size={18} />To‘lov to‘liq balansdan amalga oshdi</div>}
            </>
          )}
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setReceiptId(result.id)}><LuPrinter size={19} /> Chek chiqarish</button>
          <button className="btn btn-outline btn-block" onClick={reset} autoFocus>Yangi buyurtma <LuArrowRight size={18} /></button>
        </div>
        {receiptId && <ReceiptModal id={receiptId} onClose={() => setReceiptId(null)} />}
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
        <div className="seg big">
          <button className={mode === 'cashback' ? 'on' : ''} onClick={() => setMode('cashback')}><LuGift size={18} /> Cashback berish</button>
          <button className={mode === 'spend' ? 'on' : ''} onClick={() => setMode('spend')}><LuWallet size={18} /> Balansdan</button>
        </div>
        <div className="seg">
          <button className={input === 'menu' ? 'on' : ''} onClick={() => setInput('menu')}><LuCoffee size={16} /> Menyu</button>
          <button className={input === 'sum' ? 'on' : ''} onClick={() => setInput('sum')}><LuCalculator size={16} /> Erkin summa</button>
        </div>

        {input === 'menu' ? (
          <>
            <div className="chips">
              {categories.map((c) => <button key={c} className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>{c}</button>)}
            </div>
            {products.length === 0 ? (
              <div className="empty"><LuClipboardList size={36} />Menyu bo‘sh. Admin panelda mahsulot qo‘shing yoki “Erkin summa”dan foydalaning.</div>
            ) : (
              <div className="menu-grid">
                {shown.map((p) => (
                  <button key={p.id} className={`menu-item ${cart[p.id] ? 'in' : ''}`} onClick={() => add(p.id)}>
                    {cart[p.id] > 0 && <em>{cart[p.id]}</em>}
                    <b>{p.name}</b>
                    <small className="num">{num(p.price)}</small>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="amount-display">
              <span className="eyebrow">Chek summasi</span>
              <div className={`num ${total ? '' : 'placeholder'}`}>{total ? num(total) : '0'} <span>so‘m</span></div>
            </div>
            <section className="keypad">
              {KEYS.map((k) => (
                <button key={k} onClick={() => press(k)} className={k === 'del' ? 'key-del' : ''} aria-label={k === 'del' ? 'O‘chirish' : k}>
                  {k === 'del' ? <LuDelete size={26} /> : k}
                </button>
              ))}
            </section>
          </>
        )}
      </section>

      <aside className={`order ${open ? 'open' : ''}`}>
        <div className="order-head">
          <h3><LuReceipt size={18} /> Buyurtma {input === 'menu' && itemsCount > 0 && <span className="count">{itemsCount}</span>}</h3>
          <div className="row">
            {(lines.length > 0 || amount) && <button className="btn btn-ghost btn-sm" onClick={() => { setCart({}); setAmount('') }}><LuTrash2 size={15} /> Tozalash</button>}
            {input === 'menu' && lines.length > 0 && (
              <button className="order-toggle" onClick={() => setOpen((o) => !o)}>{open ? <LuChevronDown size={18} /> : <LuChevronUp size={18} />}</button>
            )}
          </div>
        </div>

        {input === 'menu' && (
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
        )}

        <div className="order-total"><span className="muted">Jami</span><b className="num">{som(total)}</b></div>
        {mode === 'cashback' && total > 0 && <div className="order-cb"><LuGift size={15} /> Mijozga cashback ({percent}%): <b>+{som(Math.floor((total * percent) / 100))}</b></div>}
        {mode === 'spend' && total > 0 && <div className="order-cb"><LuWallet size={15} /> Mijoz balansidan yechiladi, yetmasa — qolgani naqd</div>}
        {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
        <button id="gen-btn" className="btn btn-primary btn-lg btn-block" onClick={generate} disabled={busy || !total}>
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

  useEffect(() => {
    setData(null); setError('')
    supabase.rpc('cashier_report', { p_days: days }).then(({ data, error }) => (error ? setError(errText(error)) : setData(data)))
  }, [days])

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
        <Stat icon={LuTrendingUp} label="Cheklar summasi" value={v(s?.total_amount, som)} dark wide />
        <Stat icon={LuReceipt} label="Tranzaksiyalar" value={v(s?.total_count)} />
        <Stat icon={LuUsers} label="Mijozlar" value={v(s?.unique_customers)} />
        <Stat icon={LuGift} label="Berilgan cashback" value={v(s?.total_cashback, som)} />
        <Stat icon={LuWallet} label="Balansdan to‘langan" value={v(s?.total_balance_used, som)} />
      </div>

      <h3 className="section-title">So‘nggi cheklar</h3>
      {data && data.recent.length === 0 && <div className="empty"><LuReceipt size={36} />Bu davrda amallar yo‘q</div>}
      {data && data.recent.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Chek №</th><th>Vaqt</th><th>Mijoz</th><th>Turi</th><th className="r">Chek</th><th className="r">Bonus</th></tr></thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} onClick={() => setReceiptId(r.id)} className={`click ${r.status === 'reversed' ? 'dim' : ''}`}>
                  <td className="primary" data-label="Chek №">№{r.receipt_no}</td>
                  <td data-label="Vaqt">{dateTime(r.confirmed_at)}</td>
                  <td data-label="Mijoz">{r.customer_name || '—'}</td>
                  <td data-label="Turi"><span className={`tag ${r.status === 'reversed' ? 'reversed' : r.type}`}>{r.status === 'reversed' ? 'Qaytarilgan' : r.type === 'cashback' ? 'Cashback' : 'Balans'}</span></td>
                  <td data-label="Chek" className="r num">{num(r.amount)}</td>
                  <td data-label="Bonus" className={`r num ${r.type === 'cashback' ? 'pos' : 'neg'}`}>{r.type === 'cashback' ? `+${num(r.cashback_amount)}` : `−${num(r.balance_used)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {receiptId && <ReceiptModal id={receiptId} onClose={() => setReceiptId(null)} />}
    </div>
  )
}
