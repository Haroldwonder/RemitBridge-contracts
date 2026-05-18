import { useEffect, useState } from 'react';
import api from '../api';
import Layout from '../components/Layout';
import AnchorModal from '../components/AnchorModal';

const STATUS_COLOR = {
  complete: 'bg-green-900/40 text-green-300',
  partial: 'bg-yellow-900/40 text-yellow-300',
  failed: 'bg-red-900/40 text-red-300',
  pending: 'bg-slate-700 text-slate-300',
  submitted: 'bg-blue-900/40 text-blue-300',
};

export default function AuditTrail() {
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(null); // { batch, payments }
  const [anchor, setAnchor] = useState(null); // { amount, currency }
  const [clawbackIdx, setClawbackIdx] = useState('');
  const [clawbackMsg, setClawbackMsg] = useState('');

  useEffect(() => { api.get('/audit').then(r => setBatches(r.data)).catch(() => {}); }, []);

  async function openBatch(id) {
    const { data } = await api.get(`/audit/${id}`);
    setSelected(data);
    setClawbackMsg('');
  }

  function exportCsv(id) {
    window.open(`/api/audit/${id}/export`, '_blank');
  }

  // Clawback is a contract call — here we simulate it via the audit log
  async function handleClawback(batchId) {
    if (!clawbackIdx && clawbackIdx !== 0) { setClawbackMsg('Enter a payment index'); return; }
    try {
      // In production this would call the Soroban contract; here we record it in audit log
      await api.post(`/batches/${batchId}/clawback`, { payment_index: clawbackIdx });
      setClawbackMsg(`✓ Clawback recorded for index ${clawbackIdx}`);
    } catch (e) {
      setClawbackMsg(e.response?.data?.error || 'Clawback failed');
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl">
        <h2 className="text-2xl font-bold mb-6">Audit trail</h2>

        {selected ? (
          <div>
            <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-300 text-sm mb-4">← All batches</button>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Batch #{selected.batch.id}</h3>
                <p className="text-slate-400 text-sm">{new Date(selected.batch.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAnchor({ amount: selected.batch.total_amount, currency: selected.batch.currency })}
                  className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                >
                  🌍 Anchor sim
                </button>
                <button onClick={() => exportCsv(selected.batch.id)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-2 rounded-lg">
                  ⬇ Export CSV
                </button>
              </div>
            </div>

            {/* Clawback panel */}
            <div className="bg-slate-800 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-slate-300 mb-2">Admin clawback (within 48h)</p>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min="0" placeholder="Payment index"
                  className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={clawbackIdx} onChange={e => setClawbackIdx(e.target.value)}
                />
                <button onClick={() => handleClawback(selected.batch.id)}
                  className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg">
                  Clawback
                </button>
                {clawbackMsg && <span className="text-sm text-slate-300">{clawbackMsg}</span>}
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-700">
                  <tr className="text-slate-300 text-left">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tx hash</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.payments.map((p, i) => (
                    <tr key={p.id} className="border-t border-slate-700">
                      <td className="px-4 py-3 text-slate-500">{i}</td>
                      <td className="px-4 py-3">
                        {p.recipient_name || <span className="font-mono text-xs text-slate-400">{p.stellar_address.slice(0, 16)}…</span>}
                        {p.recipient_email && <div className="text-xs text-slate-500">{p.recipient_email}</div>}
                      </td>
                      <td className="px-4 py-3">{p.amount} {p.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status] || ''}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {p.tx_hash ? (
                          <a href={`https://stellar.expert/explorer/testnet/tx/${p.tx_hash}`} target="_blank" rel="noreferrer"
                            className="text-indigo-400 hover:underline font-mono text-xs">{p.tx_hash.slice(0, 16)}…</a>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr className="text-slate-300 text-left">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Success / Failed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-slate-500 text-center">No batches yet</td></tr>
                ) : batches.map(b => (
                  <tr key={b.id} className="border-t border-slate-700 hover:bg-slate-700/50 cursor-pointer" onClick={() => openBatch(b.id)}>
                    <td className="px-4 py-3">{new Date(b.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{b.recipient_count}</td>
                    <td className="px-4 py-3 font-medium">{Number(b.total_amount).toLocaleString()} {b.currency}</td>
                    <td className="px-4 py-3">
                      <span className="text-green-400">{b.success_count || 0}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="text-red-400">{b.failed_count || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[b.status] || ''}`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={e => { e.stopPropagation(); exportCsv(b.id); }}
                        className="text-slate-400 hover:text-white text-xs">CSV</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {anchor && <AnchorModal amount={anchor.amount} currency={anchor.currency} onClose={() => setAnchor(null)} />}
    </Layout>
  );
}
