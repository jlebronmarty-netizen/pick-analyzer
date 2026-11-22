import {test, expect} from '@playwright/test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import NcaabDashboard from '../../src/components/dashboard/NcaabDashboard';
import {buildNcaabArchivedEvidence} from '../../src/lib/ncaab-archived-evidence';
import type {NcaabReport} from '../../src/lib/ncaab-checkpoint';
import {archiveForecast, archiveReceipt, archiveAsOf, archiveDate} from '../fixtures/ncaab-archived-evidence.mjs';

function compiledStyles(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? compiledStyles(file) : entry.name.endsWith('.css') ? [file] : [];
  });
}

// Offline SSR integration fixture using the production components and compiled
// CSS. It exercises native disclosure/keyboard behavior, not client filter hydration.
for (const viewport of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844}]) {
  test(`archived NCAAB price evidence is readable and explicit on ${viewport.name}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route('https://**', route => route.abort());
    const data=JSON.parse(readFileSync('src/data/ncaab-checkpoint.json','utf8'));
    const forecast=archiveForecast(),receipt=archiveReceipt();
    receipt.captured_at='2026-11-21T19:00:00Z';
    data.observations=[forecast];data.generatedAt=archiveAsOf;
    data.models=data.models.map((m:{id:string})=>({...m,forecasts:m.id==='NCAAB_PRESEASON_V1'?1:0,
      abstentions:0,settled:0,wins:0,losses:0,winnerDenominator:0,accuracy:null}));
    data.archivedEvidence=buildNcaabArchivedEvidence({forecasts:[forecast],receipts:[receipt],asOf:archiveAsOf,dates:[archiveDate]});
    const report={status:'AVAILABLE',data} as NcaabReport;
    const styles=compiledStyles('.next/static').map(file=>readFileSync(file,'utf8')).join('\n');
    expect(styles.length,'Run npm run build before this browser fixture').toBeGreaterThan(100);
    const html=renderToStaticMarkup(React.createElement(NcaabDashboard,{report}));
    await page.setContent(`<html lang="es"><head><style>${styles}</style></head><body class="bg-slate-950 text-white"><main>${html}</main></body></html>`);
    await expect(page.getByRole('heading',{name:'Cuotas y contexto archivados'})).toBeVisible();
    const details=page.locator('details').filter({hasText:'Evidencia archivada'});
    await details.locator('summary').focus();await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open','');
    await expect(details).toContainText('DraftKings');
    await expect(details).toContainText('neutral; la etiqueta local no implica ventaja de cancha');
    await expect(details).toContainText('llegó después del pronóstico');
    await expect(details).toContainText('Sin EV ni recomendación');
    await expect(details).toContainText('Hora propia del operador: sin verificar');
    await expect(details).not.toContainText('FanDuel');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await details.screenshot({path:testInfo.outputPath(`ncaab-reference-${viewport.name}.png`)});
  });
}
