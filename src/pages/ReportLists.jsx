import { useEffect, useState } from 'react'
import { LuAlertCircle, LuCalendarDays, LuChevronRight, LuClock, LuTrendingDown, LuTrendingUp, LuWallet } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { errText, num, som } from '../lib/format'
import Stat from '../components/Stat'
import { duration, shiftRange } from './Shift'

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const WD = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const dayLabel = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d}-${MONTHS[m - 1]}` }
const wd = (s) => { const [y, m, d] = s.split('-').map(Number); return WD[new Date(y, m - 1, d).getDay()] }

// Tez filtrlar: [nom, () => [dan, gacha]]
const PRESETS = [
  ['today', 'Bugun', () => { const t = new Date(); return [iso(t), iso(t)] }],
  ['yesterday', 'Kecha', () => { const t = add(new Date(), -1); return [iso(t), iso(t)] }],
  ['7', '7 kun', () => [iso(add(new Date(), -6)), iso(new Date())]],
  ['30', '30 kun', () => [iso(add(new Date(), -29)), iso(new Date())]],
  ['month', 'Shu oy', () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)] }],
  ['prev', 'O‘tgan oy', () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))] }],
]

function RangeFilter({ range, setRange }) {
  const [preset, setPreset] = useState('7')
  const pick = (id, fn) => { setPreset(id); setRange(fn()) }
  const today = iso(new Date())
  return (
    <div className="range-filter">
      <div className="chips">
        {PRESETS.map(([id, l, fn]) => <button key={id} className={preset === id ? 'on' : ''} onClick={() => pick(id, fn)}>{l}</button>)}
      </div>
      <div className="range-dates">
        <label><span>dan</span><input type="date" className="input" value={range[0]} max={range[1]} onChange={(e) => { setPreset(''); setRange([e.target.value || range[0], range[1]]) }} /></label>
        <label><span>gacha</span><input type="date" className="input" value={range[1]} min={range[0]} max={today} onChange={(e) => { setPreset(''); setRange([range[0], e.target.value || range[1]]) }} /></label>
      </div>
    </div>
  )
}

function useList(fn, range) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setData(null); setError('')
    supabase.rpc(fn, { p_from: range[0], p_to: range[1] }).then(({ data, error }) => (error ? setError(errText(error)) : setData(data)))
  }, [fn, range[0], range[1]])
  return { data, error }
}

const notRun = (e) => (/function|schema cache/i.test(e) ? 'Supabase’da 15_shift_lists.sql ishga tushirilmagan' : e)

// ---------------------------------------------------------------------
// KUNLAR: har kun — tushum, cheklar, mahsulot, xarajat, sof, smenalar
// ---------------------------------------------------------------------
export function DayList({ onOpen }) {
  const [range, setRange] = useState(PRESETS[2][2]())
  const { data, error } = useList('cashier_day_list', range)
  const [hideEmpty, setHideEmpty] = useState(true)
  const days = (data?.days || []).filter((d) => !hideEmpty || d.count || d.expenses || d.shifts)
  const t = data?.total
  const best = Math.max(1, ...(data?.days || []).map((d) => d.paid))

  return (
    <div className="stack" style={{ gap: 14 }}>
      <RangeFilter range={range} setRange={setRange} />
      {error && <div className="alert err"><LuAlertCircle size={18} />{notRun(error)}</div>}
      <div className="stats">
        <Stat icon={LuTrendingUp} label="Tushum" value={t ? som(t.paid) : '…'} dark wide />
        <Stat icon={LuWallet} label="Xarajat" value={t ? som(t.expenses) : '…'} />
        <Stat icon={LuTrendingDown} label="Sof (tushum − xarajat)" value={t ? som(t.paid - t.expenses) : '…'} />
        <Stat icon={LuClock} label="Smenalar" value={t ? num(t.shifts) : '…'} hint={t ? `${num(t.count)} ta chek` : ''} />
      </div>
      <label className="check-row"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Savdo bo‘lmagan kunlarni yashirish</label>
      {data && days.length === 0 && <div className="empty"><LuCalendarDays size={32} />Bu oraliqda savdo yo‘q</div>}
      {days.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Kun</th><th className="r">Smena</th><th className="r">Cheklar</th><th className="r">Mahsulot</th><th className="r">Tushum</th><th className="r">Xarajat</th><th className="r">Sof</th><th /></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="click" onClick={() => onOpen(d.day, null)}>
                  <td className="primary" data-label="Kun">{dayLabel(d.day)} <span className="muted small">{wd(d.day)}</span>
                    <span className="sold-bar"><i style={{ width: `${(d.paid / best) * 100}%` }} /></span></td>
                  <td data-label="Smena" className="r num">{d.shifts || '—'}</td>
                  <td data-label="Cheklar" className="r num">{num(d.count)}</td>
                  <td data-label="Mahsulot" className="r num">{num(d.items)} ta</td>
                  <td data-label="Tushum" className="r num"><b>{num(d.paid)}</b></td>
                  <td data-label="Xarajat" className="r num">{d.expenses ? `−${num(d.expenses)}` : '0'}</td>
                  <td data-label="Sof" className={`r num ${d.net < 0 ? 'neg' : ''}`}>{num(d.net)}</td>
                  <td className="acts"><div><LuChevronRight size={18} className="muted" /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// SMENALAR: har smena — kun, vaqt, kassir, tushum, xarajat, sof, naqd pul farqi
// ---------------------------------------------------------------------
export function ShiftList({ onOpen }) {
  const [range, setRange] = useState(PRESETS[2][2]())
  const { data, error } = useList('cashier_shift_list', range)
  const list = data?.shifts || []
  const paid = list.reduce((a, s) => a + Number(s.paid), 0)
  const exp = list.reduce((a, s) => a + Number(s.expenses), 0)
  const shortage = list.reduce((a, s) => a + Math.min(0, Number(s.totals?.difference || 0)), 0)

  return (
    <div className="stack" style={{ gap: 14 }}>
      <RangeFilter range={range} setRange={setRange} />
      {error && <div className="alert err"><LuAlertCircle size={18} />{notRun(error)}</div>}
      <div className="stats">
        <Stat icon={LuTrendingUp} label="Smenalar tushumi" value={data ? som(paid) : '…'} dark wide />
        <Stat icon={LuWallet} label="Xarajat" value={data ? som(exp) : '…'} />
        <Stat icon={LuClock} label="Smenalar" value={data ? num(list.length) : '…'} hint={data ? `${list.filter((s) => s.is_open).length} ta ochiq` : ''} />
        <Stat icon={LuTrendingDown} label="Kamomad (jami)" value={data ? som(-shortage) : '…'} />
      </div>
      {data && list.length === 0 && <div className="empty"><LuClock size={32} />Bu oraliqda smena ochilmagan</div>}
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Smena</th><th>Kun / vaqt</th><th>Kassir</th><th className="r">Cheklar</th><th className="r">Tushum</th><th className="r">Xarajat</th><th className="r">Sof</th><th className="r">Kassa farqi</th><th /></tr></thead>
            <tbody>
              {list.map((s) => {
                const diff = s.totals?.difference
                return (
                  <tr key={s.id} className="click" onClick={() => onOpen(s.day, s.id)}>
                    <td className="primary" data-label="Smena">№{s.shift_no} {s.is_open && <span className="tag on">ochiq</span>}</td>
                    <td data-label="Kun / vaqt">{dayLabel(s.day)} · {shiftRange(s)}<span className="sub">{duration(s.opened_at, s.closed_at)}</span></td>
                    <td data-label="Kassir">{s.opened_by_name}{s.closed_by_name && s.closed_by_name !== s.opened_by_name && <span className="sub">yopgan: {s.closed_by_name}</span>}</td>
                    <td data-label="Cheklar" className="r num">{num(s.count)}<span className="sub">{num(s.items)} mahsulot</span></td>
                    <td data-label="Tushum" className="r num"><b>{num(s.paid)}</b></td>
                    <td data-label="Xarajat" className="r num">{s.expenses ? `−${num(s.expenses)}` : '0'}</td>
                    <td data-label="Sof" className="r num">{num(s.paid - s.expenses)}</td>
                    <td data-label="Kassa farqi" className="r num">
                      {diff == null ? <span className="muted small">{s.is_open ? 'ochiq' : '—'}</span> : diff === 0 ? <span className="tag on">to‘g‘ri</span> : <span className={`tag ${diff < 0 ? 'off' : 'amber'}`}>{diff > 0 ? '+' : ''}{num(diff)}</span>}
                    </td>
                    <td className="acts"><div><LuChevronRight size={18} className="muted" /></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
