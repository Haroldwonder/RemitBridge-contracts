// Hardcoded FX rates: 1 USDC = X local currency
const FX_RATES = {
  NGN: { rate: 1580, flag: '🇳🇬', name: 'Nigerian Naira' },
  KES: { rate: 132, flag: '🇰🇪', name: 'Kenyan Shilling' },
  GHS: { rate: 15.2, flag: '🇬🇭', name: 'Ghanaian Cedi' },
  ZAR: { rate: 18.6, flag: '🇿🇦', name: 'South African Rand' },
  UGX: { rate: 3780, flag: '🇺🇬', name: 'Ugandan Shilling' },
  TZS: { rate: 2650, flag: '🇹🇿', name: 'Tanzanian Shilling' },
};

export default function AnchorModal({ amount, currency, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Anchor cash-out simulation</h3>
            <p className="text-slate-400 text-sm">SEP-24 · Stellar testnet</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="bg-slate-700 rounded-lg p-3 mb-4 text-sm">
          <span className="text-slate-400">Sending: </span>
          <span className="font-bold text-white">{Number(amount).toLocaleString()} {currency}</span>
        </div>

        <p className="text-slate-400 text-xs mb-3">Recipient receives (estimated):</p>
        <div className="space-y-2">
          {Object.entries(FX_RATES).map(([code, { rate, flag, name }]) => {
            const local = (Number(amount) * rate).toLocaleString(undefined, { maximumFractionDigits: 0 });
            return (
              <div key={code} className="flex justify-between items-center bg-slate-700 rounded-lg px-3 py-2">
                <span className="text-sm">{flag} {name}</span>
                <span className="font-mono font-bold text-green-400">{local} {code}</span>
              </div>
            );
          })}
        </div>

        <p className="text-slate-500 text-xs mt-4">
          ⚠ Simulated rates only. Live Anchor integration (SEP-24) not included in v1.
        </p>
      </div>
    </div>
  );
}
