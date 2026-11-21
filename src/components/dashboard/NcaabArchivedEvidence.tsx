import type {NcaabEventArchiveEvidence} from '@/lib/ncaab-archived-evidence';

const time = (iso: string) => new Intl.DateTimeFormat('es', {timeZone: 'America/Puerto_Rico', dateStyle: 'medium', timeStyle: 'short'}).format(new Date(iso));
const odds = (n: number) => n > 0 ? '+' + n : String(n);
const reasonText: Record<string, string> = {
  FORECAST_REQUIRES_REVIEW: 'Pronóstico o identidad en revisión.',
  NO_RECEIPT_IN_WINDOW: 'Sin recibo archivado para esta fecha dentro de la ventana consultada.',
  CONFLICTING_LATEST_RECEIPTS: 'Hay recibos incompatibles con la misma hora de captura.',
  INVALID_RECEIPT_ORDER: 'Un recibo tiene identidad u hora inválida; no se puede acreditar cuál es el último precio.',
  INVALID_OR_TRUNCATED_RECEIPT: 'El último recibo no permite verificar la cobertura.',
  EVENT_ABSENT_FROM_LATEST_RECEIPT: 'El evento ya no aparece en el último recibo; no se recupera una cuota anterior.',
  AMBIGUOUS_EVENT: 'Evento duplicado o competencia ambigua.',
  EVENT_TEAM_IDENTITY_MISMATCH: 'Los equipos del recibo no coinciden con el pronóstico.',
  QUOTE_TEAM_IDENTITY_MISMATCH: 'Los equipos de la cuota no coinciden con el pronóstico.',
  UNVERIFIED_OR_CHANGED_SCHEDULE: 'El horario cambió o no está confirmado.',
  NOT_A_PREGAME_RECEIPT: 'El último recibo no acredita precios anteriores al inicio.',
  NO_ODDS_IN_LATEST_RECEIPT: 'El último recibo no contiene un par de cuotas verificable.',
  CONFLICTING_QUOTE_PAIRS: 'Hay precios incompatibles para el mismo operador y mercado.',
  MISSING_OPERATOR: 'La cuota no identifica al operador.',
  INVALID_OR_INCOMPLETE_MONEYLINE_PAIR: 'Par moneyline incompleto o inválido.',
  INVALID_OR_INCOMPLETE_SPREAD_PAIR: 'Par spread incompleto o líneas incompatibles.',
  INVALID_OR_INCOMPLETE_TOTAL_PAIR: 'Par total incompleto o líneas incompatibles.',
};
export default function NcaabArchivedEvidence({evidence}: {evidence?: NcaabEventArchiveEvidence}) {
  if (!evidence) return <p className="mt-3 text-xs text-slate-400">Evidencia de cuotas fuera de la ventana consultada. No se afirma que falte en todo el archivo.</p>;
  return <details className="mt-4 rounded-lg border border-slate-700 p-3 text-xs text-slate-300">
    <summary className="cursor-pointer font-semibold text-teal-200">Evidencia archivada · {evidence.quotes.length ? 'referencia de precios' : 'sin precio verificable en este recibo'}</summary>
    <p className="mt-3">Sede: {evidence.neutralSite === true ? 'neutral; la etiqueta local no implica ventaja de cancha' : evidence.neutralSite === false ? 'no neutral según la fuente' : 'sin verificar'}.</p>
    {evidence.capturedAt && <p className="mt-2">Captura de Pick: {time(evidence.capturedAt)} PR. Hora propia del operador: sin verificar.</p>}
    {evidence.knownAtOriginalEmission !== null && <p className="mt-2 text-amber-200">{evidence.knownAtOriginalEmission ? 'Este recibo ya estaba disponible al emitirse el pronóstico.' : 'Este recibo llegó después del pronóstico; no demuestra que ese precio estuviera disponible al emitirlo.'}</p>}
    {evidence.quotes.map(q => <p key={q.sportsbook + q.market} className="mt-2 break-words">
      <strong>{q.sportsbook} · {q.market === 'MONEYLINE' ? 'Moneyline' : q.market === 'SPREAD' ? 'Spread' : 'Total'}</strong>: {' '}
      {q.first.side === 'OVER' ? 'Over' : 'Local'}{q.first.line !== null ? ' ' + q.first.line : ''} ({odds(q.first.americanOdds)}) · {' '}
      {q.second.side === 'UNDER' ? 'Under' : 'Visitante'}{q.second.line !== null ? ' ' + q.second.line : ''} ({odds(q.second.americanOdds)}).
    </p>)}
    {evidence.reasons.filter(r => reasonText[r]).map(r => <p key={r} className="mt-2 text-amber-200">{reasonText[r]}</p>)}
    <p className="mt-3">Partido completo; reglas de prórroga sin confirmar. Precios archivados, sin vigencia de ejecución certificada. El campo «close» de la fuente no certifica una cuota de cierre. Sin EV ni recomendación.</p>
    {evidence.sourceId && <p className="mt-2 break-all text-slate-500">Recibo {evidence.sourceId}</p>}
  </details>;
}
