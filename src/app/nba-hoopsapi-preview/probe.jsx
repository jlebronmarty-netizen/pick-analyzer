'use client';
import {useState} from 'react';
const periods = ['all', 'q1', 'q2', 'q3', 'q4', 'h1', 'h2', 'ft'];
const markets = ['all', 'total', 'spread', 'moneyline', 'team_total_home', 'team_total_away'];
const time = x => x && Number.isFinite(Date.parse(x))
  ? new Intl.DateTimeFormat('es-PR', {timeZone: 'America/Puerto_Rico', dateStyle: 'short', timeStyle: 'short'}).format(new Date(x))
  : 'Fecha no verificada';
const format = v => v === null || v === undefined ? '—' : Number.isFinite(Number(v)) ? String(v) : '—';
export default function Probe() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('all');
  const [market, setMarket] = useState('all');
  async function run() {
    if (busy) return;
    setBusy(true); setError(''); setData(null);
    try {
      const response = await fetch('/api/nba/hoopsapi-preview', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({confirm: 'HOOPS_NBA_SINGLE_MANUAL_REQUEST'}), cache: 'no-store',
      });
      const payload = await response.json();
      setData(payload);
      if (!response.ok) setError(payload.status || 'No se pudo consultar HoopsAPI');
    } catch { setError('La conexión no respondió. No repitas la consulta hasta revisar el estado del proveedor.'); }
    finally { setBusy(false); }
  }
  // Export only the already-captured response. Neither button invokes the provider.
  function saveFile(filename, content, mime) {
    const url = URL.createObjectURL(new Blob([content], {type: mime}));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click();
    anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadCapture(kind) {
    if (!data || !Array.isArray(data.quotes) || !data.coverage) return;
    const stamp = String(data.captured_at ?? 'unknown').replace(/[^0-9TZ-]/g, '_');
    if (kind === 'json') {
      saveFile('hoopsapi_nba_preview_' + stamp + '.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
      return;
    }
    const cols = ['provider_game_id','period','market','side','team_side','line','decimal_odds','american_odds_approx',
      'source_received_at','provider_updated_at','regional_price_verified','capture_version'];
    const csv = [cols, ...data.quotes.map(row => cols.map(k => row[k]))]
      .map(row => row.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
    saveFile('hoopsapi_nba_preview_' + stamp + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
  }
  const quotes = (data?.quotes || []).filter(q => (period === 'all' || q.period === period) && (market === 'all' || q.market === market));
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 text-slate-100">
    <header className="rounded-xl border border-slate-600 p-5">
      <a href="/nba-market-data" className="text-sky-300 underline">← NBA FanDuel / GOAT</a>
      <h1 className="mt-3 text-2xl font-bold">HoopsAPI · prueba privada NBA</h1>
      <p className="mt-2 text-sm text-slate-300">Preview solamente. Una consulta por pulsación para todos los juegos NBA y sus mercados principales por período. Sin capturas automáticas ni escrituras a Supabase; no se crea ningún pick.</p>
      <p className="mt-2 text-sm text-amber-200">El proveedor limita la cuenta gratuita a 10 consultas cada 24 horas. Esta fase NO tiene un contador duradero propio; no pulses repetidamente.</p>
      <button type="button" disabled={busy || data !== null} onClick={run}
        className="mt-4 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? 'Consultando una vez…' : 'Probar HoopsAPI (gasta 1 consulta)'}
      </button>
      {error && <p role="alert" className="mt-3 text-amber-200">{error}</p>}
      {data?.quotes?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadCapture('csv')} className="rounded bg-emerald-700 px-3 py-2 text-white">Descargar todas las líneas (CSV)</button>
        <button type="button" onClick={() => downloadCapture('json')} className="rounded bg-slate-700 px-3 py-2 text-white">Guardar captura y procedencia (JSON)</button>
      </div>}
      {data !== null && <p className="mt-2 text-xs text-slate-300">Esta página no permitirá otra llamada mientras esté abierta. Descarga la respuesta antes de cerrarla.</p>}

    </header>
    {data && <section className="rounded-xl border border-slate-600 p-5 space-y-2">
      <h2 className="text-xl font-semibold">{data.status || 'Resultado'}</h2>
      <p>Recibido: {time(data.captured_at)} · {data.coverage?.nba_games ?? 0} partidos NBA · {data.coverage?.normalized_quote_sides ?? 0} lados de cuota · {data.coverage?.missing_fanduel_games ?? 0} partidos sin FanDuel.</p>
      <p>Períodos sin precio FanDuel: {data.coverage?.periods_without_fanduel_prices?.join(', ') || 'ninguno'}</p>
      <p className="text-sm text-amber-200">La disponibilidad para apostar en FanDuel Puerto Rico no está verificada. Las cuotas americanas son conversiones aproximadas desde precios decimales.</p>
      <div className="flex flex-wrap gap-4 pt-3">
        <label>Período <select value={period} onChange={e => setPeriod(e.target.value)} className="ml-2 rounded bg-slate-800 p-2">{periods.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
        <label>Mercado <select value={market} onChange={e => setMarket(e.target.value)} className="ml-2 rounded bg-slate-800 p-2">{markets.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
      </div>
      {quotes.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr>{['Partido','Período','Mercado','Selección','Línea','Cuota decimal','Cuota US aprox.'].map(h => <th key={h} className="border-b border-slate-700 p-2">{h}</th>)}</tr></thead>
        <tbody>{quotes.map(q => {
          const game = data.games.find(g => g.provider_game_id === q.provider_game_id);
          return <tr key={q.quote_id}>
            <td className="border-b border-slate-800 p-2">{game ? game.away_team + ' @ ' + game.home_team : q.provider_game_id}</td>
            <td className="border-b border-slate-800 p-2">{q.period}</td><td className="border-b border-slate-800 p-2">{q.market}</td>
            <td className="border-b border-slate-800 p-2">{q.team_side ? q.team_side + ' · ' : ''}{q.side}</td>
            <td className="border-b border-slate-800 p-2">{format(q.line)}</td>
            <td className="border-b border-slate-800 p-2">{format(q.decimal_odds)}</td>
            <td className="border-b border-slate-800 p-2">{q.american_odds_approx > 0 ? '+' : ''}{format(q.american_odds_approx)}</td>
          </tr>;
        })}</tbody>
      </table></div> : <p>Sin cotizaciones que coincidan con el filtro o la respuesta. No implica que FanDuel no ofrezca el mercado.</p>}
      <p className="pt-3 text-xs text-slate-400">{data.limitations?.join(' · ')}</p>
    </section>}
  </main>;
}
