import { useEffect, useState } from 'react'
import { LuAlertCircle, LuCheck, LuPlus, LuReceipt, LuWallet } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { dateTime, errText, num, som } from '../lib/format'
import { MIN_NOTE } from '../components/ReasonModal'

const DEFAULT_CATS = ['Mahsulot', 'Kofe donasi', 'Sut', 'Kommunal', 'Ijara', 'Ish haqi', 'Tozalash', 'Ta’mirlash', 'Transport', 'Boshqa']

// Kassir: kunlik xarajatlarni kiritadi (izoh majburiy)
export default function Expenses() {
  const [days, setDays] = useState(1)
  const [data, setData] = useState(null)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  const load = () => supabase.rpc('cashier_expenses', { p_days: days }).then(({ data, error }) => (error ? setError(errText(error)) : setData(data)))
  useEffect(() => { load() }, [days])

  const n = parseInt(amount.replace(/\D/g, '') || '0', 10)
  const noteOk = note.trim().length >= MIN_NOTE
  const cats = data?.categories || DEFAULT_CATS

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setSaved(null)
    if (!n) return setError('Summani kiriting')
    if (!category) return setError('Xarajat turini tanlang')
    if (!noteOk) return setError(`Izoh majburiy: kamida ${MIN_NOTE} ta belgi yozing (nima uchun, kimga, qancha)`)
    setBusy(true)
    const { data: row, error } = await supabase.rpc('add_expense', { p_amount: n, p_category: category, p_note: note.trim() })
    setBusy(false)
    if (error) return setError(errText(error))
    setSaved(row); setAmount(''); setNote(''); setCategory('')
    load()
  }

  return (
    <div className="report">
      <div className="report-head">
        <h2>Xarajatlar</h2>
        <div className="seg">
          {[[1, 'Bugun'], [7, '7 kun'], [30, '30 kun']].map(([d, l]) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>)}
        </div>
      </div>

      <div className="expense-grid">
        <form className="card stack" onSubmit={submit}>
          <h3 className="row" style={{ gap: 8, fontSize: 17 }}><LuPlus size={18} /> Yangi xarajat</h3>
          <label className="field"><span>Summa (so‘m)</span>
            <input className="input big-input num" inputMode="numeric" value={amount ? num(n) : ''} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </label>
          <div className="field"><span>Turi</span>
            <div className="chips wrap">
              {cats.map((c) => <button type="button" key={c} className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>{c}</button>)}
            </div>
          </div>
          <label className="field"><span>Izoh <b style={{ color: 'var(--red)' }}>*</b> — nima uchun, kimga, qancha</span>
            <textarea className="input textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: 20 litr sut, Nestle yetkazib beruvchi" required />
            <small className={`note-count ${noteOk ? 'ok' : ''}`}>{noteOk ? 'Izoh yozildi' : `Izoh majburiy — yana ${MIN_NOTE - note.trim().length} ta belgi`}</small>
          </label>
          {error && <div className="alert err"><LuAlertCircle size={18} />{error}</div>}
          {saved && <div className="alert ok"><LuCheck size={18} />Saqlandi: {saved.category} — {som(saved.amount)}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !n || !category || !noteOk}>
            <LuWallet size={19} /> {busy ? 'Saqlanmoqda…' : 'Xarajatni saqlash'}
          </button>
          <p className="muted small">Kiritilgan xarajatni o‘chirib bo‘lmaydi — xato bo‘lsa, administrator bekor qiladi. Hammasi adminga ko‘rinadi.</p>
        </form>

        <section className="stack">
          <div className="stat dark">
            <div className="stat-top"><LuWallet size={16} /><span>{days === 1 ? 'Bugungi xarajat' : `${days} kunlik xarajat`}</span></div>
            <b className="num">{data ? som(data.total) : '…'}</b>
            <em>{data ? `${data.items.filter((i) => i.status === 'active').length} ta yozuv` : ''}</em>
          </div>
          {data && data.items.length === 0 && <div className="empty"><LuReceipt size={32} />Xarajat kiritilmagan</div>}
          {data?.items.length > 0 && (
            <ul className="list">
              {data.items.map((x) => (
                <li key={x.id} className={`list-item ${x.status === 'cancelled' ? 'dim' : ''}`}>
                  <span className="list-ico coffee"><LuWallet size={18} /></span>
                  <span className="list-main">
                    <b>{x.category}</b>
                    <small>{dateTime(x.created_at)} · {x.cashier_name} · {x.note}</small>
                    {x.status === 'cancelled' && <small style={{ color: 'var(--red)' }}>Admin bekor qildi: {x.cancel_note}</small>}
                  </span>
                  <span className="list-end"><span className="num" style={x.status === 'cancelled' ? { textDecoration: 'line-through' } : null}>−{num(x.amount)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
