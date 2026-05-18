import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import Layout from '../components/Layout';

const STATUS_COLOR = {
  complete: 'bg-green-900/40 text-green-300',
  partial: 'bg-yellow-900/40 text-yellow-300',
  failed: 'bg-red-900/40 text-red-300',
  pending: 'bg-slate-700 text-slate-300',
  submitted: 'bg-blue-900/40 text-blue-300',
};
const PAY_COLOR = { success: 'text-green-400', failed: 'text-red-400', pending: 'text-slate-400' };

export default function BatchDetail() {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');
  const pollRef = useRef();

  async function load() {
    try {
      const { data } = await api.get(`/batches/${id}`);
      setBatch(data.batch);
      setPayments(data.payments);
      return data.batch.status;
    } catch {
      setError('Batch not found');
    }
  }

  useEffect(() => {
    load().then(status => {
      if (status === 'pending' || status === 'submitted') {
        pollRef.current = setInterval(async () => {
          const s = await load();
          if (s !== 'pending' && s !== 'submitted') clearInterval(pollRef.current);
        }, 2000);
      }
    });
    return () => clearInterval(pollRef.current);
  }, [id]);

  if (error) return (
    <Layout>
      <div className="text-red-400 p-6">{error}</div>
    </Layout>
  );

  if (!batch) return (
    <Layout>
      <div className="text-slate-400 p-6 animate-pulse">Loading…</div>
    </Layout>
  );

  const isLive = batch.status === 'pending' || batch.status === 'submitted';

  return (
    <Layout>
      <div className="max-w-4xl">
        <Link to="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm mb-4 inline-block">← Dashboard</Link>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">Batch #{batch.id}</h2>
            <p className="text-slate-400 text-sm mt-1">{new Date(batch.created_at).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            {isLive && <span className="text-blue-400 text-sm animate-pulse">● Processing…</span>}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[batch.status] || ''}`}>
              {batch.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs">Total</p>
            <p className="text-xl font-bold mt-1">{Number(batch.total_amount).toLocaleString()} {batch.currency}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs">Recipients</p>
            <p className="text-xl font-bold mt-1">{batch.recipient_count}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs">Success / Failed</p>
            <p className="text-xl font-bold mt-1">
              <span className="text-green-400">{payments.filter(p => p.status === 'success').length}</span>
              <span className="text-slate-500"> / </span>
              <span className="text-red-400">{payments.filter(p => p.status === 'failed').length}</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-slate-700">
            <h3 className="font-semibold text-sm">Payments</h3>
            <a href={`/api/audit/${id}/export`} target="_blank" rel="noreferrer"
              className="text-slate-400 hover:text-white text-xs">⬇ Export CSV</a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tx hash</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-slate-500 text-center animate-pulse">
                  Waiting for payments…
                </td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="border-t border-slate-700">
                  <td className="px-4 py-3">
                    {p.recipient_name || <span className="font-mono text-xs text-slate-400">{p.stellar_address.slice(0, 16)}…</span>}
                  </td>
                  <td className="px-4 py-3">{p.amount} {p.currency}</td>
                  <td className={`px-4 py-3 font-medium ${PAY_COLOR[p.status] || ''}`}>{p.status}</td>
                  <td className="px-4 py-3">
                    {p.tx_hash ? (
                      <a href={`https://stellar.expert/explorer/testnet/tx/${p.tx_hash}`}
                        target="_blank" rel="noreferrer"
                        className="text-indigo-400 hover:underline font-mono text-xs">
                        {p.tx_hash.slice(0, 16)}…
                      </a>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
