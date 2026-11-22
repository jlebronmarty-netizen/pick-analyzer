import {test, expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';

let fixtureHtml: string;
test.beforeAll(() => {
  // The normal TypeScript loader renders real React elements. Importing TSX
  // directly here lets Playwright's JSX transform create component-test objects.
  fixtureHtml=execFileSync(process.execPath,[
    '--loader','./tests/dashboard-multisport/tsx-loader.mjs',
    './tests/fixtures/render-ncaab-archived-evidence.mjs',
  ],{encoding:'utf8',timeout:30_000,maxBuffer:10*1024*1024,
    env:{...process.env,NODE_NO_WARNINGS:'1'}});
  expect(fixtureHtml).toContain('Cuotas y contexto archivados');
});

// Offline SSR integration fixture using the production components and compiled
// CSS. It exercises native disclosure/keyboard behavior, not client filter hydration.
for (const viewport of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844}]) {
  test(`archived NCAAB price evidence is readable and explicit on ${viewport.name}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route('https://**', route => route.abort());
    await page.setContent(fixtureHtml);
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
