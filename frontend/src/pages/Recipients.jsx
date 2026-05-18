import { useEffect, useState, useRef } from 'react';
import api from '../api';
import Layout from '../components/Layout';

export default function Recipients() {
  const [recipients, setRecipients] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', stellar_address: '', phone: '' });
  const [error, setError] = useState('');
  const [csvMsg, setCsvMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef();

  async function load() {
    const { data } = await api.get('/recipients');
    setRecipients(data);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault(); setError('');
    try {
      await api.post('/recipients', form);
      setForm({ name: '', email: '', stellar_address: '', phone: '' });
      setShowForm(false);
      load();
    } catch (e) { setError(e.response?.data?.error || 'Failed'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete recipient?')) return;
    await api.delete(`/recipients/${id}`);
    load();
  }

  async function handleCsv(e) {
    const file = e.target.files[0]; if (!file) return;
    setCsvMsg('');
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post('/recipients/csv', fd);
      setCsvMsg(`✓ Imported ${data.inserted} recipients${data.errors.length ? `, ${data.errors.length} errors` : ''}`);
      load();
    } catch (e) { setCsvMsg('Upload failed: ' + (e.response?.data?.error || e.message)); }
    fileRef.current.value = '';
  }

  return (
    <Layout>
      <div className="max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Recipients</h2>
          <div className="flex gap-2">
            <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-2 rounded-lg transition">
              📤 Import CSV
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
            </label>
            <button onClick={() => setShowForm(v => !v)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg transition">
              + Add recipient
            </button>
          </div>
        </div>

        {csvMsg && <div className="bg-slate-700 text-slate-200 rounded-lg p-3 mb-4 text-sm">{csvMsg}</div>}

        {showForm && (
          <form onSubmit={handleAdd} className="bg-slate-800 rounded-xl p-5 mb-6 grid grid-cols-2 gap-3">
            {error && <div className="col-span-2 text-red-400 text-sm">{error}</div>}
            {[['name', 'Name *'], ['email', 'Email'], ['stellar_address', 'Stellar address'], ['phone', 'Phone']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-slate-400 text-xs mb-1">{label}</label>
                <input
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  required={k === 'name'}
                />
              </div>
            ))}
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-sm px-3 py-2">Cancel</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg">Save</button>
            </div>
          </form>
        )}

        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr className="text-slate-300 text-left">
                <th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Stellar address</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-slate-500 text-center">No recipients yet</td></tr>
              ) : recipients.map(r => (
                <tr key={r.id} className="border-t border-slate-700">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-slate-400">{r.email || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400 truncate max-w-xs">{r.stellar_address || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-slate-500 text-xs mt-3">CSV format: name, email, stellar_address, phone (header row required, max 500 rows)</p>
      </div>
    </Layout>
  );
}
