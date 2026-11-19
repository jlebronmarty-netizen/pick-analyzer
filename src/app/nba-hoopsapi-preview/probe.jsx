'use client';
import {useEffect, useRef, useState} from 'react';
const periods = ['all', 'q1', 'q2', 'q3', 'q4', 'h1', 'h2', 'ft'];
const markets = ['all', 'total', 'spread', 'moneyline', 'team_total_home', 'team_total_away'];
const time = x => x && Number.isFinite(Date.parse(x))
  ? new Intl.DateTimeFormat('es-PR', {timeZone: 'America/Puerto_Rico', dateStyle: 'short', timeStyle: 'short'}).format(new Date(x))
  : 'Fecha no verificada';
const format = v => v === null || v === undefined ? '—' : Number.isFinite(Number(v)) ? String(v) : '—';
export default function Probe() {
  const attemptLock = useRef(false);
  const [attempted, setAttempted] = useState(false);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('all');
  const [market, setMarket] = useState('all');
  async function restore() {
    try {
      const response = await fetch('/api/nba/hoopsapi-preview', {cache:'no-store'});
      const payload = await response.json();
      setState(payload);
      if (payload.capture) setData(previous => !previous?.captured_at ||
        Date.parse(payload.capture.captured_at) >= Date.parse(previous.captured_at) ? payload.capture : previous);
      if (!response.ok) setError(payload.status || 'No se pudo leer la captura guardada');
    } catch { setState(null); setError('No se pudo verificar el registro. La consulta al proveedor permanece bloqueada.'); }
  }
  useEffect(() => {
    try {
      const stamp = Number(sessionStorage.getItem('nba_hoopsapi_attempted_at_v2'));
      if (stamp > 0 && Date.now() - stamp < 86400000) { attemptLock.current = true; setAttempted(true); }
    } catch { /* Immediate ref lock still prevents duplicate clicks in this page. */ }
    void restore(); // Database GET only; never calls HoopsAPI.
  }, []);
  async function run() {
    if (busy || attemptLock.current || !state?.capture_enabled) return;
    attemptLock.current = true; setAttempted(true);
    try { sessionStorage.setItem('nba_hoopsapi_attempted_at_v2', String(Date.now())); } catch { /* Ref remains locked. */ }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/nba/hoopsapi-preview', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({confirm: 'HOOPS_NBA_SINGLE_MANUAL_REQUEST', request_id: crypto.randomUUID()}), cache: 'no-store',
      });
      const payload = await response.json();
      if (Array.isArray(payload.quotes)) setData(payload);
      if (!response.ok) setError(payload.status || 'No se pudo consultar HoopsAPI');
      await restore();
    } catch { setError('La conexión no respondió. Usa Recuperar última captura; no repitas la consulta al proveedor.'); }
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
    const cols = ['capture_id','quote_id','provider','sportsbook','provider_game_id','home_team','away_team','start_time',
      'period','market','side','team_side','line','decimal_odds','american_odds_approx',
      'source_received_at','provider_updated_at','regional_price_verified','capture_version','response_sha256'];
    const csv = [cols, ...data.quotes.map(row => {
      const game = data.games.find(g => g.provider_game_id === row.provider_game_id) || {};
      const complete = {...game,...row,capture_id:data.capture_id,response_sha256:data.response_sha256};
      return cols.map(k => complete[k]);
    })].map(row => row.map(value => {
      const text = String(value ?? '');
      const safe = typeof value === 'string' && /^[=+@-]/.test(text) ? "'" + text : text;
      return '"' + safe.replaceAll('"','""') + '"';
    }).join(',')).join('\r\n');
    saveFile('hoopsapi_nba_preview_' + stamp + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
  }
  const quotes = (data?.quotes || []).filter(q => (period === 'all' || q.period === period) && (market === 'all' || q.market === market));
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 text-slate-100">
    <header className="rounded-xl border border-slate-600 p-5">
      <a href="/nba-market-data" className="text-sky-300 underline">← NBA FanDuel / GOAT</a>
      <h1 className="mt-3 text-2xl font-bold">HoopsAPI · prueba privada NBA</h1>
      <p className="mt-2 text-sm text-slate-300">Una consulta manual guarda la respuesta y los mercados principales por período. La captura se puede recuperar al volver a abrir la página. No hay capturas automáticas.</p>
      <p className="mt-2 text-sm text-amber-200">Límite de la aplicación: hasta 10 intentos por cuenta en 24 horas móviles. Las consultas realizadas fuera de esta integración también consumen el cupo del proveedor.</p>
      <p className="mt-2 text-sm text-slate-300">Registro: {state?.quota?.status || state?.status || 'Verificando…'} · Intentos registrados en 24 h: {state?.quota?.charged_attempts_24h ?? '—'} · Cupos de la aplicación: {state?.quota?.remaining_app_reservations ?? '—'}{state?.quota?.blocked_until ? ' · Bloqueado hasta ' + time(state.quota.blocked_until) : ''}</p>
      <button type="button" disabled={busy || attempted || !state?.capture_enabled} onClick={run}
        className="mt-4 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? 'Capturando una vez…' : 'Capturar HoopsAPI (gasta 1 consulta)'}
      </button>
      <button type="button" disabled={busy} onClick={restore} className="ml-3 mt-4 rounded-lg bg-slate-700 px-4 py-2 disabled:opacity-50">Recuperar última captura (sin consulta)</button>
      {error && <p role="alert" className="mt-3 text-amber-200">{error}</p>}
      {data?.quotes?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadCapture('csv')} className="rounded bg-emerald-700 px-3 py-2 text-white">Descargar todas las líneas (CSV)</button>
        <button type="button" onClick={() => downloadCapture('json')} className="rounded bg-slate-700 px-3 py-2 text-white">Guardar captura y procedencia (JSON)</button>
      </div>}
      {attempted && <p className="mt-2 text-xs text-slate-300">El intento quedó bloqueado en esta pestaña, incluso si la conexión falló. Recuperar y descargar no consumen consultas.</p>}

    </header>
    {data && <section className="rounded-xl border border-slate-600 p-5 space-y-2">
      <h2 className="text-xl font-semibold">{data.status || 'Resultado'}</h2>
      <p className={data.capture_persisted ? 'text-emerald-300' : 'text-amber-200'}>{data.capture_persisted ? 'Captura guardada y recuperable.' : 'Guardado no confirmado. Descarga esta respuesta y revisa la recuperación.'}</p>
      <p>Recibido: {time(data.captured_at)} · {data.coverage?.nba_games ?? 0} partidos NBA · {data.coverage?.normalized_quote_sides ?? 0} lados de cuota · {data.coverage?.missing_fanduel_games ?? 0} partidos sin FanDuel.</p>
      <p>Períodos sin precio en ningún partido de la respuesta: {data.coverage?.periods_without_fanduel_prices?.join(', ') || 'ninguno'}</p>
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

