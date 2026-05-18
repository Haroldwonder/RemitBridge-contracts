import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { org } = useAuth();
  const [batches, setBatches] = useState([]);
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    api.get('/batches').then(r => setBatches(r.data)).catch(() => {});
    api.get('/recipients').then(r => setRecipients(r.data)).catch(() => {});
  }, []);

  const totalDisbursed = batches
    .filter(b => b.status === 'complete' || b.status === 'partial')
    .reduce((s, b) => s + Number(b.total_amount), 0);

  const recent = batches.slice(0, 5);

  const statusColor = { complete: 'text-green-400', partial: 'text-yellow-400', failed: 'text-red-400', pending: 'text-slate-400', submitted: 'text-blue-400' };

  return (
    <Layout>
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold mb-1">Dashboard</h2>
        <p className="text-slate-400 text-sm mb-6">
          Stellar public key: <span className="font-mono text-xs text-indigo-300">{org?.stellar_public_key}</span>
        </p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Total disbursed" value={`$${totalDisbursed.toLocaleString()}`} sub="USDC + PYUSD" />
          <StatCard label="Batches" value={batches.length} />
          <StatCard label="Recipients" value={recipients.length} />
        </div>

        <div className="bg-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Recent batches</h3>
            <Link to="/audit" className="text-indigo-400 text-sm hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-slate-500 text-sm">No batches yet. <Link to="/batches/new" className="text-indigo-400 hover:underline">Create one</Link></p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="pb-2">Date</th><th className="pb-2">Recipients</th>
                  <th className="pb-2">Total</th><th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(b => (
                  <tr key={b.id} className="border-t border-slate-700 hover:bg-slate-700/50 cursor-pointer">
                    <td className="py-2">
                      <Link to={`/batches/${b.id}`} className="block hover:text-indigo-300">
                        {new Date(b.created_at).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="py-2">{b.recipient_count}</td>
                    <td className="py-2">{Number(b.total_amount).toLocaleString()} {b.currency}</td>
                    <td className={`py-2 font-medium ${statusColor[b.status] || ''}`}>{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
