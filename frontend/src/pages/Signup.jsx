import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', country: '', use_case: 'ngo', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/orgs/signup', form);
      setSecretKey(data.secretKey);
      login(data.token, data.org);
    } catch (e) {
      setError(e.response?.data?.error || 'Signup failed');
    } finally { setLoading(false); }
  }

  function copy() {
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (secretKey) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-lg shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔑</span>
          <h2 className="text-xl font-bold text-white">Save your secret key</h2>
        </div>
        <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-3 mb-4 text-amber-300 text-sm">
          This is the only time your Stellar secret key will be shown. Copy it now — it is never stored.
        </div>
        <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-green-400 break-all mb-4">
          {secretKey}
        </div>
        <div className="flex gap-3">
          <button onClick={copy} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg py-2 font-semibold transition">
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
          <button onClick={() => nav('/dashboard')} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 font-semibold transition">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-1">Create organisation</h1>
        <p className="text-slate-400 mb-6 text-sm">Get started with RemitBridge</p>
        {error && <div className="bg-red-900/40 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[['name', 'Organisation name'], ['country', 'Country'], ['password', 'Password']].map(([k, label]) => (
            <div key={k}>
              <label className="block text-slate-300 text-sm mb-1">{label}</label>
              <input
                type={k === 'password' ? 'password' : 'text'}
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                required
              />
            </div>
          ))}
          <div>
            <label className="block text-slate-300 text-sm mb-1">Use case</label>
            <select
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.use_case} onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))}
            >
              <option value="ngo">NGO</option>
              <option value="employer">Employer</option>
              <option value="remittance">Remittance</option>
            </select>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 transition"
          >
            {loading ? 'Creating…' : 'Create organisation'}
          </button>
        </form>
        <p className="text-slate-400 text-sm mt-4 text-center">
          Already have an account? <Link to="/login" className="text-indigo-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
