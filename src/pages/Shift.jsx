import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LuAlertCircle, LuCheck, LuClock, LuLock, LuUnlock, LuPrinter, LuX } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errText, fullDate, num, som } from '../lib/format'
import Modal from '../components/Modal'
import { printNode, RECEIPT_FOOTER } from '../components/Receipt'

// ---------------------------------------------------------------------
// Smena holati: butun kassa ilovasi uchun bitta joyda
// ---------------------------------------------------------------------
const ShiftCtx = createContext(null)

export function ShiftProvider({ children }) {
  const [state, setState] = useState({ loaded: false, open: null, last: null, error: '' })
  const reload = useCallback(async () => {
    const { data, error } = await supabase.rpc('cashier_shift')
    if (error) setState((s) => ({ ...s, loaded: true, error: errText(error) }))
    else setState({ loaded: true, open: data?.open || null, last: data?.last || null, error: '' })
  }, [])
  useEffect(() => {
    reload()
    const t = setInterval(reload, 30000) // boshqa kassir yopsa/ochsa ham yangilanadi
    return () => clearInterval(t)
  }, [reload])
  return <ShiftCtx.Provider value={{ ...state, reload }}>{children}</ShiftCtx.Provider>
}
export const useShift = () => useContext(ShiftCtx)

const timeHM = (iso) => (iso ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '')
export const duration = (from, to) => {
  const m = Math.max(0, Math.round(((to ? new Date(to) : new Date()) - new Date(from)) / 60000))
  return m < 60 ? `${m} daq` : `${Math.floor(m / 60)} soat ${m % 60} daq`
}
export const shiftRange = (s) => `${timeHM(s.opened_at)} – ${s.closed_at ? timeHM(s.closed_at) : 'hozir'}`

// ---------------------------------------------------------------------
// Tepadagi smena tugmasi (kassaning eng ko'rinadigan joyi)
// ---------------------------------------------------------------------
export function ShiftPill() {
  const shift = useShift()
  const [modal, setModal] = useState(null) // 'open' | 'close'
  if (!shift?.loaded) return null
  const s = shift.open
  return (
    <>
      <button className={`shift-pill ${s ? 'on' : 'off'}`} onClick={() => setModal(s ? 'close' : 'open')}
        title={s ? 'Smena ma’lumotlari va yopish' : 'Smenani ochish'}>
        <i className="dot" />
        {s ? <><b><span className="hide-xs">Smena </span>№{s.shift_no}</b><span className="hide-sm">· {timeHM(s.opened_at)} dan</span></> : <b><span className="hide-xs">Smena </span>yopiq</b>}
      </button>
      {modal === 'open' && <OpenShiftModal onClose={() => setModal(null)} />}
      {modal === 'close' && <CloseShiftModal onClose={() => setModal(null)} />}
    </>
  )
}

// ---------------------------------------------------------------------
// Kassa bo'limining tepasidagi smena paneli: jonli hisob + "Smenani yopish"
// ---------------------------------------------------------------------
export function ShiftBar() {
  const shift = useShift()
  const [closing, setClosing] = useState(false)
  const s = shift?.open
  if (!s) return null
  return (
    <div className="shift-bar">
      <span className="shift-bar-ico"><i className="dot" /></span>
      <div className="shift-bar-main">
        <b>Smena №{s.shift_no} ochiq</b>
        <small>{timeHM(s.opened_at)} dan · {duration(s.opened_at)} · {s.opened_by_name}</small>
      </div>
      <div className="shift-bar-nums">
        <span><small>Cheklar</small><b className="num">{num(s.count)}</b></span>
        <span><small>Tushum</small><b className="num">{num(s.paid)}</b></span>
        <span className="hide-sm"><small>Xarajat</small><b className="num">{num(s.expenses)}</b></span>
      </div>
      <button className="btn btn-outline btn-sm shift-bar-close" onClick={() => setClosing(true)}><LuLock size={15} /> Smenani yopish</button>
      {closing && <CloseShiftModal onClose={() => setClosing(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Smena yopiq bo'lsa Kassa va Xarajat o'rnida chiqadigan ekran
// ---------------------------------------------------------------------
export function ShiftGate({ children }) {
  const shift = useShift()
  if (!shift?.loaded) return <div className="skeleton"><div /><div /></div>
  if (shift.open) return children
  return (
    <div className="shift-gate">
      <div className="card stack shift-gate-card">
        <span className="shift-gate-ico"><LuLock size={30} /></span>
        <h2>Smena yopiq</h2>
        <p className="muted">Sotuv va xarajat kiritish uchun avval smenani oching. Smena davomidagi barcha savdo, xarajat va naqd pul alohida hisoblanadi.</p>
        {shift.error && <div className="alert err"><LuAlertCircle size={18} />{shift.error}</div>}
        <OpenShiftForm />
        {shift.last && (
          <p className="muted small">Oxirgi smena: №{shift.last.shift_no} · {fullDate(shift.last.opened_at)} – {timeHM(shift.last.closed_at)} · {shift.last.closed_by_name} · tushum {som(shift.last.paid)}</p>
        )}
      </div>
    </div>
  )
}

const QUICK = [10000, 50000, 100000, 200000]

function CashInput({ value, setValue, label, autoFocus }) {
  const n = parseInt(String(value).replace(/\D/g, '') || '0', 10)
  return (
    <>
      <label className="field"><span>{label}</span>
        <input className="input big-input num" inputMode="numeric" autoFocus={autoFocus}
          value={value === '' ? '' : num(n)} onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="0" />
      </label>
      <div className="quick-sum">
        {QUICK.map((q) => <button type="button" key={q} className="btn btn-outline" onClick={() => setValue(String(Math.min(n + q, 1000000000)))}>+{num(q)}</button>)}
        <button type="button" className="btn btn-ghost" onClick={() => setValue('')} disabled={!n} aria-label="Tozalash" title="Tozalash"><LuX size={18} /></button>
      </div>
    </>
  )
}

function OpenShiftForm({ onDone }) {
  const shift = useShift()
  const [cash, setCash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.rpc('cashier_open_shift', { p_opening_cash: parseInt(cash || '0', 10) })
    setBusy(false)
    if (error) { setError(errText(error)); if (/SHIFT_ALREADY_OPEN/.test(error.message)) shift.reload(); return }
    await shift.reload()
    onDone?.()
  }
  return (
    <form className="stack" onSubmit={submit}>
      <CashInput value={cash} setValue={setCash} label="Kassadagi boshlang‘ich naqd pul (so‘m)" />
      {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}><LuUnlock size={19} /> {busy ? 'Ochilmoqda…' : 'Smenani ochish'}</button>
    </form>
  )
}

function OpenShiftModal({ onClose }) {
  return (
    <Modal title="Smenani ochish" onClose={onClose}>
      <OpenShiftForm onDone={onClose} />
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Smenani yopish: jonli hisob, naqd pulni sanash, farq, Z-hisobot
// ---------------------------------------------------------------------
function CloseShiftModal({ onClose }) {
  const shift = useShift()
  const s = shift.open
  const [cash, setCash] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  useEffect(() => { shift.reload() }, []) // eslint-disable-line

  if (result) return <ShiftResultModal result={result} onClose={() => { shift.reload(); onClose() }} />
  if (!s) return null

  const expected = s.opening_cash + s.paid - s.expenses
  const counted = cash === '' ? null : parseInt(cash, 10)
  const diff = counted == null ? null : counted - expected

  const submit = async (e) => {
    e.preventDefault()
    if (counted == null) return setError('Kassadagi naqd pulni sanab kiriting')
    if (diff !== 0 && note.trim().length < 5) return setError('Farq bor — sababini izohda yozing (kamida 5 ta belgi)')
    if (!window.confirm(`Smena №${s.shift_no} yopilsinmi? Yopilgach bu smenada sotuv qilib bo‘lmaydi.`)) return
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('cashier_close_shift', { p_closing_cash: counted, p_note: note.trim() || null })
    setBusy(false)
    if (error) return setError(errText(error))
    setResult(data)
  }

  return (
    <Modal title={`Smena №${s.shift_no}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="shift-meta">
          <span><LuClock size={14} /> {fullDate(s.opened_at)} dan · {duration(s.opened_at)}</span>
          <span>Ochgan: <b>{s.opened_by_name}</b></span>
        </div>
        <div className="shift-sum">
          <div><small>Cheklar</small><b className="num">{num(s.count)}</b></div>
          <div><small>Tushum</small><b className="num">{som(s.paid)}</b></div>
          <div><small>Xarajat</small><b className="num">−{num(s.expenses)}</b></div>
        </div>
        <div className="shift-cash">
          <div className="paper-row"><span>Boshlang‘ich naqd</span><span className="num">{som(s.opening_cash)}</span></div>
          <div className="paper-row"><span>+ Tushum</span><span className="num">{som(s.paid)}</span></div>
          <div className="paper-row"><span>− Xarajat</span><span className="num">{som(s.expenses)}</span></div>
          <div className="paper-row big"><span>Kassada bo‘lishi kerak</span><b className="num">{som(expected)}</b></div>
        </div>
        <CashInput value={cash} setValue={setCash} label="Kassadagi naqd pul — sanab kiriting (so‘m)" />
        {diff != null && (
          <div className={`alert ${diff === 0 ? 'ok' : 'err'}`}>
            {diff === 0 ? <><LuCheck size={18} />Kassa to‘g‘ri — farq yo‘q</> : <><LuAlertCircle size={18} />{diff > 0 ? 'Ortiqcha' : 'Kamomad'}: <b>&nbsp;{som(Math.abs(diff))}</b></>}
          </div>
        )}
        <label className="field"><span>Izoh {diff ? <b style={{ color: 'var(--red)' }}>* farq sababi majburiy</b> : '(ixtiyoriy)'}</span>
          <textarea className="input textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: smenani Aziza qabul qildi" />
        </label>
        <p className="muted small">Yopilganda skanerlanmagan QR’lar bekor bo‘ladi. Smena hisoboti adminga ko‘rinadi.</p>
        {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
        <button className="btn btn-danger btn-lg btn-block" disabled={busy}><LuLock size={19} /> {busy ? 'Yopilmoqda…' : 'Smenani yopish'}</button>
      </form>
    </Modal>
  )
}

function ShiftResultModal({ result, onClose }) {
  const { profile } = useAuth() || {}
  const s = result.shift
  const st = result.summary.stats
  return (
    <Modal title={`Smena №${s.shift_no} yopildi`} onClose={onClose}>
      <div className="stack">
        <div className={`alert ${result.difference === 0 ? 'ok' : 'err'}`}>
          {result.difference === 0 ? <><LuCheck size={18} />Kassa to‘g‘ri yopildi</> : <><LuAlertCircle size={18} />{result.difference > 0 ? 'Ortiqcha' : 'Kamomad'}: {som(Math.abs(result.difference))}</>}
        </div>
        <div className="shift-sum">
          <div><small>Cheklar</small><b className="num">{num(st.total_count)}</b></div>
          <div><small>Tushum</small><b className="num">{som(st.total_paid)}</b></div>
          <div><small>Mahsulot</small><b className="num">{num(st.items_sold)} ta</b></div>
        </div>
        <ul className="shift-products">
          {result.summary.products.map((p) => <li key={p.name}><span>{p.name}</span><b className="num">{p.qty} ta</b><span className="num">{num(p.revenue)}</span></li>)}
        </ul>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => printShift({ ...s, totals: { expected_cash: result.expected_cash, difference: result.difference } }, result.summary, profile?.cafe?.name)}><LuPrinter size={18} /> Smena hisobotini chop etish</button>
          <button className="btn btn-ghost" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Chop etiladigan smena hisoboti (Z-hisobot) — chek printerida
// ---------------------------------------------------------------------
export function ShiftPaper({ shift: s, summary, cafeName }) {
  const st = summary.stats
  const exp = summary.expenses?.total || 0
  const expected = s.totals?.expected_cash ?? s.opening_cash + st.total_paid - exp
  return (
    <div className="paper">
      <div className="paper-logo"><img src="/logo-mark.png" alt="" /><b>COFFEEGRAM</b></div>
      {cafeName && <div className="paper-c paper-cafe">{cafeName}</div>}
      <div className="paper-line" />
      <div className="paper-c paper-title">SMENA HISOBOTI №{s.shift_no}</div>
      <Row l="Ochildi" r={fullDate(s.opened_at)} />
      <Row l="Ochgan" r={s.opened_by_name} />
      <Row l="Yopildi" r={s.closed_at ? fullDate(s.closed_at) : 'ochiq'} />
      {s.closed_by_name && <Row l="Yopgan" r={s.closed_by_name} />}
      <div className="paper-line" />
      {summary.products.map((p) => (
        <div key={p.name} className="paper-item">
          <div>{p.name}{p.stamp ? ' ☆' : ''}</div>
          <div className="paper-row"><span>{p.qty} ta</span><span>{num(p.revenue)}</span></div>
        </div>
      ))}
      <div className="paper-line" />
      <Row l="Cheklar" r={num(st.total_count)} />
      <Row l="Mahsulotlar" r={`${num(st.items_sold)} ta`} />
      <Row l="Kofe" r={`${num(st.coffees)} ta`} />
      {st.free_given > 0 && <Row l="Bepul kofe" r={`${st.free_given} · −${num(st.discount)}`} />}
      <Row l={<b>TUSHUM</b>} r={<b>{num(st.total_paid)} so‘m</b>} big />
      <div className="paper-line" />
      <Row l="Boshlang‘ich naqd" r={num(s.opening_cash)} />
      <Row l="Xarajatlar" r={`−${num(exp)}`} />
      <Row l="Kutilgan naqd" r={num(expected)} />
      {s.closing_cash != null && <Row l="Sanalgan naqd" r={num(s.closing_cash)} />}
      {s.totals?.difference != null && <Row l={<b>FARQ</b>} r={<b>{s.totals.difference > 0 ? '+' : ''}{num(s.totals.difference)}</b>} big />}
      {s.note && <div className="sm">{s.note}</div>}
      <div className="paper-line" />
      <div className="paper-c sm">{RECEIPT_FOOTER.slogan}</div>
    </div>
  )
}
function Row({ l, r, big }) {
  return <div className={`paper-row ${big ? 'big' : ''}`}><span>{l}</span><span>{r}</span></div>
}

export function printShift(shift, summary, cafeName) {
  return printNode(<ShiftPaper shift={shift} summary={summary} cafeName={cafeName} />)
}
