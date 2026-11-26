import styles from './sheet.module.css';

export function SheetCard({children}) {
  return <article className={styles.card}>{children}</article>;
}

export function FilterGroup({label, options, value, onChange}) {
  return <fieldset>
    <legend>{label}</legend>
    <div>{Object.entries(options).map(([id, text]) =>
      <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>
    )}</div>
  </fieldset>;
}

export function TrendBars({bars, scale}) {
  return <div className={styles.bars}>{bars.map(bar =>
    <div key={bar.id} className={styles.column} title={bar.title} aria-label={bar.label}>
      <b>{bar.value}</b><span data-hit={bar.hit} style={{height: (bar.value / scale * 44) + 'px'}}/>
    </div>
  )}</div>;
}
