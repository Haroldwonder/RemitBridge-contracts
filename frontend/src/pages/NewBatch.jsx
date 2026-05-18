import { useEffect, useState, useRef } from 'react';
import api from '../api';
import Layout from '../components/Layout';

const CURRENCIES = ['USDC', 'PYUSD'];
const STATUS_COLOR = { pending: 'text-slate-400', success: 'text-green-400', failed: 'text-red-400', submitted: 'text-blue-400' };

export default function NewBatch() {
  const [recipients, setRecipients] = useState([]);
  const [rows, setRows] = useState([{ recipient_id: '', stellar_address: '', amount: '', currency: 'USDC' }]);
  const [currency, setCurrency] = useState('USDC');
  const [secretKey, setSecretKey] = useState('');
  const [batch, setBatch] = useState(null);
  const [payments, setPayments] = useState([]);
  const [feeXlm, setFeeXlm] = useState('');
  const [step, setStep] = useState('build'); // build | preview | submitting | done
  const [error, setError] = useState('');
  const pollRef = useRef();

  useEffect(() => {
    api.get('/recipients').then(r => setRecipients(r.data)).catch(() => {});
  }, []);

  function addRow() {
    setRows(r => [...r, { recipient_id: '', stellar_address: '', amount: '', currency }]);
  }

  function updateRow(i, field, val) {
    setRows(r => r.map((row, idx) => {
      if (idx !== i) return row;
      const updated = { ...row, [field]: val };
      if (field === 'recipient_id' && val) {
        const rec = recipients.find(r => String(r.id) === val);
        if (rec?.stellar_address) updated.stellar_address = rec.stellar_address;
      }
      return updated;
    }));
  }

  function removeRow(i) { setRows(r => r.filter((_, idx) => idx !== i)); }

  async function handlePreview(e) {
    e.preventDefault(); setError('');
    const payments = rows.map(r => ({
      recipient_id: r.recipient_id || undefined,
      stellar_address: r.stellar_address,
      amount: r.amount,
    }));
    try {
      const { data } = await api.post('/batches', { payments, currency });
      setBatch(data.batch);
      setFeeXlm(data.fee_xlm);
      setStep('preview');
    } catch (e) { setError(e.response?.data?.error || 'Failed to create batch'); }
  }

  async function handleSubmit() {
    if (!secretKey) { setError('Enter your Stellar secret key'); return; }
    setStep('submitting'); setError('');
    try {
      await api.post(`/batches/${batch.id}/submit`, { secret_key: secretKey });
      setSecretKey('');
      pollStatus(batch.id);
    } catch (e) {
      setError(e.response?.data?.error || 'Submission failed');
      setStep('preview');
    }
  }

  function pollStatus(batchId) {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/batches/${batchId}`);
        setPayments(data.payments);
        if (['complete', 'partial', 'failed'].includes(data.batch.status)) {
          clearInterval(pollRef.current);
          setBatch(data.batch);
          setStep('done');
        }
      } catch {}
    }, 2000);
  }

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  if (step === 'submitting' || step === 'done') return (
    <Layout>
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold mb-6">{step === 'done' ? 'Batch complete' : 'Processing…'}</h2>
        {batch && (
          <div className={`rounded-lg px-4 py-2 mb-4 text-sm font-medium inline-block ${
            batch.status === 'complete' ? 'bg-green-900/40 text-green-300' :
            batch.status === 'partial' ? 'bg-yellow-900/40 text-yellow-300' :
            batch.status === 'failed' ? 'bg-red-900/40 text-red-300' : 'bg-blue-900/40 text-blue-300'
          }`}>
            Status: {batch.status}
          </div>
        )}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr className="text-slate-300 text-left">
                <th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Tx hash</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-slate-500 text-center">
                  <span className="animate-pulse">Processing payments…</span>
                </td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="border-t border-slate-700">
                  <td className="px-4 py-3">{p.recipient_name || <span className="font-mono text-xs">{p.stellar_address.slice(0, 12)}…</span>}</td>
                  <td className="px-4 py-3">{p.amount} {p.currency}</td>
                  <td className={`px-4 py-3 font-medium ${STATUS_COLOR[p.status]}`}>{p.status}</td>
                  <td className="px-4 py-3">
                    {p.tx_hash ? (
                      <a href={`https://stellar.expert/explorer/testnet/tx/${p.tx_hash}`} target="_blank" rel="noreferrer"
                        className="text-indigo-400 hover:underline font-mono text-xs">{p.tx_hash.slice(0, 12)}…</a>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {step === 'done' && (
          <button onClick={() => { setStep('build'); setBatch(null); setPayments([]); setRows([{ recipient_id: '', stellar_address: '', amount: '', currency: 'USDC' }]); }}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm">
            New batch
          </button>
        )}
      </div>
    </Layout>
  );

  if (step === 'preview') return (
    <Layout>
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">Confirm batch</h2>
        <div className="bg-slate-800 rounded-xl p-5 mb-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Recipients</span><span>{rows.length}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="font-bold">{total.toLocaleString()} {currency}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Estimated fee</span><span>{feeXlm} XLM</span></div>
        </div>
        {error && <div className="bg-red-900/40 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
        <div className="bg-slate-800 rounded-xl p-5 mb-4">
          <label className="block text-slate-300 text-sm mb-2">Stellar secret key (used once, never stored)</label>
          <input
            type="password"
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="S…"
            value={secretKey} onChange={e => setSecretKey(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setStep('build')} className="text-slate-400 hover:text-white px-4 py-2 text-sm">← Back</button>
          <button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-semibold text-sm">
            Submit batch
          </button>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold mb-6">New disbursement batch</h2>
        {error && <div className="bg-red-900/40 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handlePreview}>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-slate-300 text-sm">Currency</label>
            {CURRENCIES.map(c => (
              <button key={c} type="button" onClick={() => setCurrency(c)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${currency === c ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {c}
              </button>
            ))}
          </div>

          <div className="bg-slate-800 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr className="text-slate-300 text-left">
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Stellar address</th>
                  <th className="px-4 py-3">Amount ({currency})</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-700">
                    <td className="px-4 py-2">
                      <select
                        className="bg-slate-700 text-white rounded px-2 py-1 text-sm w-full"
                        value={row.recipient_id}
                        onChange={e => updateRow(i, 'recipient_id', e.target.value)}
                      >
                        <option value="">— manual —</option>
                        {recipients.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="bg-slate-700 text-white rounded px-2 py-1 font-mono text-xs w-full"
                        placeholder="G…"
                        value={row.stellar_address}
                        onChange={e => updateRow(i, 'stellar_address', e.target.value)}
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number" min="0.01" step="0.01"
                        className="bg-slate-700 text-white rounded px-2 py-1 text-sm w-28"
                        value={row.amount}
                        onChange={e => updateRow(i, 'amount', e.target.value)}
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <button type="button" onClick={addRow} className="text-indigo-400 hover:text-indigo-300 text-sm">+ Add row</button>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-sm">Total: <strong className="text-white">{total.toLocaleString()} {currency}</strong></span>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-semibold text-sm">
                Preview →
              </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
