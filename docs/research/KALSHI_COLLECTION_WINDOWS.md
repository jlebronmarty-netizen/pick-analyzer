# Kalshi: primera descarga en Windows (solo lectura)

Sin cuenta de Kalshi ni llave de API. No realiza operaciones.

1. En PowerShell, abre una carpeta donde quieras copiar el repositorio.
2. Ejecuta estos comandos:

```powershell
git clone --branch research/kalshi-market-intelligence-v1-20261116 https://github.com/jlebronmarty-netizen/pick-analyzer.git pick-kalshi-research
cd pick-kalshi-research
node scripts/research/kalshi-batch-six-markets.mjs
```

Node.js 20+ es suficiente y no hace falta `npm install` para el recolector.

3. Revisa `tmp/kalshi-market-intelligence/batch-summary.json`. Si dice `INCOMPLETE`, incluye el error y no uses los resultados como muestra completa. Si dice `DOWNLOADED_UNVALIDATED`, solo confirma la descarga de transacciones; falta verificar calidad, cronología, fechas de inicio y mercado correcto.
4. Adjunta `batch-summary.json`, los `*.trades.json` y `*.manifest.json` de esta carpeta al chat para evaluar cobertura, señales y backtest.

No ejecutar en el servidor ni copiar credenciales. Datos de investigación en `tmp`, no subirlos a `main` ni al dashboard sin revisión. Verificar fecha real de inicio (UTC) de cada partido antes de ejecutar cálculos pregame. El análisis estadístico sobre operadores individuales no puede hacerse sin identificadores de personas; Kalshi publica ids de trades, no de traders.
