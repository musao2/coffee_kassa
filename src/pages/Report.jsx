import { useEffect, useMemo, useState } from 'react'
import {
  LuAlertCircle, LuCalendarDays, LuChevronLeft, LuChevronRight, LuClock, LuCoffee, LuGift, LuPackage,
  LuPrinter, LuReceipt, LuRotateCcw, LuShoppingBag, LuTrendingUp, LuUsers, LuWallet,
} from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dateTime, errText, num, som } from '../lib/format'
import ReceiptModal from '../components/Receipt'
import Stat from '../components/Stat'
import ReasonModal from '../components/ReasonModal'
import { duration, printShift, shiftRange, useShift } from './Shift'
import { DayList, ShiftList } from './ReportLists'

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
const WEEK = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']

// "2026-11-11" bilan ishlash (vaqt mintaqasidan qat'i nazar)
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const parse = (s) => s.split('-').map(Number)
const dayTitle = (s) => { const [y, m, d] = parse(s); return `${d}-${MONTHS[m - 1].toLowerCase()}, ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}` }
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : num(n))

// Kassir hisoboti: kalendar → kun → smena
export default function Report() {
  const { profile } = useAuth() || {}
  const shiftNow = useShift()
  const [month, setMonth] = useState(null) // "2026-11-01"
  const [cal, setCal] = useState(null)
  const [day, setDay] = useState(null)
  const [shiftId, setShiftId] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [receiptId, setReceiptId] = useState(null)
  const [voidTx, setVoidTx] = useState(null)
  const [reload, setReload] = useState(0)
  const [mode, setMode] = useState('cal') // cal | days | shifts

  // kalendar
  useEffect(() => {
    setCal(null)
    supabase.rpc('cashier_calendar', { p_month: month }).then(({ data, error }) => {
      if (error) return setError(errText(error))
      setCal(data)
      if (!month) setMonth(data.month)
      setDay((d) => d || data.today)
    })
  }, [month, reload])

  // tanlangan kun yoki smena
  useEffect(() => {
    if (!day) return
    setData(null); setError('')
    supabase.rpc('cashier_day_report', { p_date: day, p_shift: shiftId }).then(({ data, error }) => (error ? setError(errText(error)) : setData(data)))
  }, [day, shiftId, reload])

  const pickDay = (d) => { setDay(d); setShiftId(null) }
  // Kunlar/Smenalar ro'yxatidan bosilganda — o'sha kun (va smena) batafsil ochiladi
  const openFrom = (d, sid) => { setMonth(d.slice(0, 8) + '01'); setDay(d); setShiftId(sid); setMode('cal'); window.scrollTo({ top: 0 }) }
  const moveMonth = (delta) => {
    const [y, m] = parse(month)
    const dt = new Date(y, m - 1 + delta, 1)
    setMonth(ymd(dt.getFullYear(), dt.getMonth() + 1, 1))
  }

  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString()
  const doVoid = async (note) => {
    const { error } = await supabase.rpc('cashier_reverse_transaction', { p_id: voidTx.id, p_note: note })
    if (error) throw new Error(errText(error))
    setVoidTx(null); setReceiptId(null); setReload((x) => x + 1); shiftNow?.reload()
  }

  const sum = data?.summary
  const s = sum?.stats
  const sh = data?.shift
  const v = (x, f = num) => (s ? f(x) : '…')
  const scopeLabel = sh ? `Smena №${sh.shift_no}` : day ? dayTitle(day) : ''

  return (
    <div className="report">
      <div className="report-head">
        <h2>Hisobot</h2>
        <div className="seg report-modes">
          <button className={mode === 'cal' ? 'on' : ''} onClick={() => setMode('cal')}>Kalendar</button>
          <button className={mode === 'days' ? 'on' : ''} onClick={() => setMode('days')}>Kunlar</button>
          <button className={mode === 'shifts' ? 'on' : ''} onClick={() => setMode('shifts')}>Smenalar</button>
        </div>
        {cal && mode === 'cal' && <button className="btn btn-outline btn-sm" onClick={() => { setMonth(null); setDay(null); setShiftId(null); setReload((x) => x + 1) }}><LuCalendarDays size={15} /> Bugun</button>}
      </div>
      {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}

      {mode === 'days' && <DayList onOpen={openFrom} />}
      {mode === 'shifts' && <ShiftList onOpen={openFrom} />}
      {mode === 'cal' && (
      <div className="report-grid">
        <Calendar cal={cal} month={month} day={day} onPick={pickDay} onMove={moveMonth} />

        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <div className="day-head">
            <h3>{day ? dayTitle(day) : '…'}</h3>
            {data?.shifts?.length > 0 && (
              <div className="chips">
                <button className={!shiftId ? 'on' : ''} onClick={() => setShiftId(null)}>Butun kun</button>
                {data.shifts.map((x) => (
                  <button key={x.id} className={shiftId === x.id ? 'on' : ''} onClick={() => setShiftId(x.id)}>
                    {x.is_open && <i className="live-dot" />}№{x.shift_no} · {shiftRange(x)}
                  </button>
                ))}
              </div>
            )}
            {data && data.shifts?.length === 0 && <p className="muted small">Bu kunda smena ochilmagan</p>}
          </div>

          {sh && <ShiftBox sh={sh} summary={sum} cafeName={profile?.cafe?.name} />}

          <div className="stats">
            <Stat icon={LuTrendingUp} label={`Daromad · ${scopeLabel}`} value={v(s?.total_paid, som)} dark wide />
            <Stat icon={LuReceipt} label="Cheklar" value={v(s?.total_count)} />
            <Stat icon={LuShoppingBag} label="Sotilgan mahsulot" value={v(s?.items_sold)} />
            <Stat icon={LuCoffee} label="Sotilgan kofe" value={v(s?.coffees)} />
            <Stat icon={LuWallet} label="Xarajat" value={sum ? som(sum.expenses.total) : '…'} hint={sum ? `Sof: ${som(s.total_paid - sum.expenses.total)}` : ''} />
            <Stat icon={LuGift} label="Bepul berilgan" value={v(s?.free_given)} hint={s ? `−${som(s.discount)}` : ''} />
            <Stat icon={LuUsers} label="Mijozlar" value={v(s?.unique_customers)} />
          </div>

          <ProductTiles products={sum?.products} />
          <SoldProducts data={sum} scope={`${day}-${shiftId}`} label={scopeLabel} />

          <h3 className="section-title">Cheklar <span className="muted small">{data ? `${data.recent.length} ta` : ''}</span></h3>
          {data && data.recent.length === 0 && <div className="empty"><LuReceipt size={36} />Bu davrda cheklar yo‘q</div>}
          {data?.recent.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Chek №</th><th>Vaqt</th><th>Mijoz</th><th>Buyurtma</th><th className="r">To‘lov</th><th /></tr></thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id} onClick={() => setReceiptId(r.id)} className={`click ${r.status === 'reversed' ? 'dim' : ''}`}>
                      <td className="primary" data-label="Chek №">№{r.receipt_no} {r.free_used > 0 && <span className="tag amber"><LuGift size={12} /> bepul</span>}</td>
                      <td data-label="Vaqt">{dateTime(r.confirmed_at)}</td>
                      <td data-label="Mijoz">{r.status === 'sold' ? <span className="tag sold">mijozsiz</span> : r.customer_name || '—'}</td>
                      <td data-label="Buyurtma">{(r.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ') || '—'}</td>
                      <td data-label="To‘lov" className="r num">{num(r.amount - (r.discount || 0))}</td>
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
        </div>
      </div>
      )}

      {receiptId && (
        <ReceiptModal id={receiptId} onClose={() => setReceiptId(null)}
          actions={(r) => (r.status === 'confirmed' || r.status === 'sold') && r.type === 'stamp' && isToday(r.confirmed_at) && (
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

// ---------------------------------------------------------------------
// Oy kalendari: har kunda tushum, smena belgisi
// ---------------------------------------------------------------------
function Calendar({ cal, month, day, onPick, onMove }) {
  const cells = useMemo(() => {
    if (!month) return []
    const [y, m] = parse(month)
    const first = (new Date(y, m - 1, 1).getDay() + 6) % 7 // dushanbadan boshlanadi
    const count = new Date(y, m, 0).getDate()
    const byDay = Object.fromEntries((cal?.days || []).map((d) => [d.day, d]))
    const shifts = Object.fromEntries((cal?.shifts || []).map((d) => [d.day, d.count]))
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from({ length: count }, (_, i) => { const key = ymd(y, m, i + 1); return { key, d: i + 1, info: byDay[key], shifts: shifts[key] || 0 } }),
    ]
  }, [cal, month])
  const max = Math.max(1, ...(cal?.days || []).map((d) => d.paid))
  const [y, m] = month ? parse(month) : [0, 0]
  const today = cal?.today
  const isCurrent = today && month === today.slice(0, 8) + '01'

  return (
    <section className="card calendar">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => onMove(-1)} aria-label="Oldingi oy" disabled={!month}><LuChevronLeft size={18} /></button>
        <div><b>{month ? `${MONTHS[m - 1]} ${y}` : '…'}</b><small>{cal ? `${som(cal.month_total.paid)} · ${num(cal.month_total.count)} chek` : ''}</small></div>
        <button className="icon-btn" onClick={() => onMove(1)} aria-label="Keyingi oy" disabled={!month || isCurrent}><LuChevronRight size={18} /></button>
      </div>
      <div className="cal-grid">
        {WEEK.map((w) => <span key={w} className="cal-w">{w}</span>)}
        {cells.map((c, i) => c === null ? <span key={`e${i}`} /> : (
          <button key={c.key}
            className={`cal-day ${c.key === day ? 'on' : ''} ${c.key === today ? 'today' : ''} ${c.info ? 'has' : ''}`}
            disabled={today && c.key > today}
            onClick={() => onPick(c.key)}
            style={c.info ? { '--heat': 0.12 + 0.5 * (c.info.paid / max) } : null}
            title={c.info ? `${som(c.info.paid)} · ${c.info.count} chek` : ''}>
            <b>{c.d}</b>
            {c.info && <small>{short(c.info.paid)}</small>}
            {c.shifts > 0 && <i className="cal-shift" title={`${c.shifts} smena`} />}
          </button>
        ))}
      </div>
      <p className="muted small cal-legend"><i className="cal-shift" /> smena bo‘lgan kun · rang qanchalik to‘q — daromad shuncha ko‘p</p>
    </section>
  )
}

// Tanlangan smena: kim, qachon, naqd pul, farq + chop etish
function ShiftBox({ sh, summary, cafeName }) {
  const exp = summary?.expenses?.total || 0
  const expected = sh.totals?.expected_cash ?? sh.opening_cash + sh.paid - exp
  const diff = sh.totals?.difference
  return (
    <div className="card shift-box">
      <div className="shift-box-top">
        <div>
          <b>Smena №{sh.shift_no} {sh.is_open && <span className="tag on">ochiq</span>}</b>
          <small><LuClock size={13} /> {shiftRange(sh)} · {duration(sh.opened_at, sh.closed_at)} · ochgan: {sh.opened_by_name}{sh.closed_by_name ? ` · yopgan: ${sh.closed_by_name}` : ''}</small>
        </div>
        {summary && <button className="btn btn-outline btn-sm" onClick={() => printShift(sh, summary, cafeName)}><LuPrinter size={15} /> Chop etish</button>}
      </div>
      <div className="shift-sum">
        <div><small>Boshlang‘ich naqd</small><b className="num">{num(sh.opening_cash)}</b></div>
        <div><small>Kutilgan naqd</small><b className="num">{num(expected)}</b></div>
        <div><small>Sanalgan naqd</small><b className="num">{sh.closing_cash != null ? num(sh.closing_cash) : '—'}</b></div>
        <div className={diff ? 'bad' : diff === 0 ? 'good' : ''}><small>Farq</small><b className="num">{diff == null ? '—' : `${diff > 0 ? '+' : ''}${num(diff)}`}</b></div>
      </div>
      {sh.note && <p className="muted small">Izoh: {sh.note}</p>}
    </div>
  )
}

// Har bir sotilgan mahsulot alohida kartochka: nomi, nechta, qancha summaga
export function ProductTiles({ products }) {
  if (!products?.length) return null
  return (
    <div className="product-tiles">
      {products.map((p) => (
        <div key={p.name} className={`ptile ${p.stamp ? 'coffee' : ''}`}>
          <div className="ptile-top">{p.stamp ? <LuCoffee size={15} /> : <LuPackage size={15} />}<span title={p.name}>{p.name}</span></div>
          <b className="num">{num(p.qty)} ta</b>
          <em className="num">{som(p.revenue)}</em>
        </div>
      ))}
    </div>
  )
}

// Sotilgan mahsulotlar jadvali — kategoriya bo'yicha filtr bilan
export function SoldProducts({ data, scope, label }) {
  const [cat, setCat] = useState('Hammasi')
  useEffect(() => setCat('Hammasi'), [scope])
  if (!data) return null
  const products = data.products || []
  const cats = data.categories || []
  const shown = cat === 'Hammasi' ? products : products.filter((p) => p.category === cat)
  const total = shown.reduce((a, p) => ({ qty: a.qty + p.qty, revenue: a.revenue + Number(p.revenue) }), { qty: 0, revenue: 0 })
  const max = Math.max(1, ...shown.map((p) => p.qty))

  return (
    <section className="sold-products">
      <h3 className="section-title">Sotilgan mahsulotlar <span className="muted small">{label}</span></h3>
      {products.length === 0 ? (
        <div className="empty"><LuPackage size={32} />Bu davrda mahsulot sotilmagan</div>
      ) : (
        <>
          {cats.length > 1 && (
            <div className="chips">
              <button className={cat === 'Hammasi' ? 'on' : ''} onClick={() => setCat('Hammasi')}>Hammasi · {num(products.reduce((a, p) => a + p.qty, 0))}</button>
              {cats.map((c) => <button key={c.category} className={cat === c.category ? 'on' : ''} onClick={() => setCat(c.category)}>{c.category} · {num(c.qty)}</button>)}
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Mahsulot</th><th>Kategoriya</th><th className="r">Soni</th><th className="r">Summa</th></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.name}>
                    <td className="primary" data-label="Mahsulot">
                      <span className="row" style={{ gap: 6 }}>{p.stamp ? <LuCoffee size={15} className="pos" /> : <LuPackage size={15} className="muted" />}{p.name}</span>
                      <span className="sold-bar"><i style={{ width: `${(p.qty / max) * 100}%` }} /></span>
                    </td>
                    <td data-label="Kategoriya">{p.category}</td>
                    <td data-label="Soni" className="r num"><b>{num(p.qty)} ta</b></td>
                    <td data-label="Summa" className="r num">{som(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}><b>Jami{cat !== 'Hammasi' ? ` · ${cat}` : ''}</b></td><td className="r num"><b>{num(total.qty)} ta</b></td><td className="r num"><b>{som(total.revenue)}</b></td></tr></tfoot>
            </table>
          </div>
          {data.stats?.discount > 0 && cat === 'Hammasi' && <p className="muted small">Summalar chegirmasiz narxda. Bepul berilgan kofe chegirmasi: −{som(data.stats.discount)}</p>}
        </>
      )}
    </section>
  )
}
