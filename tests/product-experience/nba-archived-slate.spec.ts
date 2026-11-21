import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// Produce the replay with the read-only board service and a historical clock.
// Archived records stay outside Git. This optional test never calls a sports provider.
test('nine-game archived slate preserves six views, evidence, order, paging and mobile layout',async({page})=>{
  const path=process.env.NBA_ARCHIVED_SLATE_FILE;
  test.skip(!path,'Requires the archived 2026-11-20 19:35 PR service replay.');
  const board=JSON.parse(readFileSync(path!,'utf8'));
  expect(Date.parse(board.asOf)).toBe(Date.parse('2026-11-20T23:35:00Z'));
  for(const list of Object.values(board.preferredRows) as any[][]){
    const keys=list.map(r=>[r.gameId,r.market,r.period,
      r.market==='props'?r.playerId+'-'+r.statistic:r.market==='spread'?Math.abs(r.line):r.line].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.every(r=>r.dataQuality.status==='VALIDATED'&&r.dataQuality.issues.length===0)).toBe(true);
  }
  expect(board.summary.calibratedPicks).toBe(0);
  await page.clock.setFixedTime(new Date(board.asOf));
  await page.route('**/api/nba/decision-board',route=>route.fulfill({json:board}));
  await page.route('**/api/nba/decision-learning',route=>route.fulfill({status:503,json:{}}));
  await page.goto('/nba-decision-board');
  const tabs=page.getByRole('navigation',{name:'Mercados NBA'}),cards=page.locator('article:visible');
  const switchTab=async(name:string)=>tabs.getByRole('button',{name:new RegExp('^'+name)}).click();
  const checkWidth=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(cards).toHaveCount(25);
  const first=cards.first();
  await first.getByRole('button',{name:'Ver contexto'}).click();
  await expect(first).toContainText('VALIDATED');
  await expect(first).toContainText('Partidos incluidos');
  await expect(first).toContainText('VIGILAR');
  await expect(first).toContainText(board.version);
  const gaps=()=>cards.evaluateAll(items=>items.map(e=>Number(Array.from(e.querySelectorAll('p')).find(p=>p.textContent==='Brecha favorable')?.nextElementSibling?.textContent)));
  const desc=await gaps();expect(desc.every(Number.isFinite)).toBe(true);expect(desc).toEqual([...desc].sort((a,b)=>b-a));
  await page.getByLabel('Ordenar oportunidades NBA').selectOption('gap_asc');
  await expect.poll(gaps).toEqual([...desc].sort((a,b)=>a-b));
  await checkWidth();
  for(const name of ['Moneyline','Spread','Total','Player props']){
    await switchTab(name);await expect(cards).toHaveCount(0);
    const panel=page.locator('details').filter({has:page.getByText('Datos pendientes de validación',{exact:true})});
    if(!await panel.evaluate(el=>(el as HTMLDetailsElement).open))await panel.locator('summary').click();
    await expect(cards.first()).toBeVisible();await expect(cards.first()).toContainText('Precio capturado');
    await expect(cards.first()).toContainText('FanDuel');
    await checkWidth();await panel.locator('summary').click();
  }
  await switchTab('Cuartos / Mitades');await expect(cards).toHaveCount(30);
  await expect(page.locator('h2').filter({hasText:'Cuartos / Mitades'})).toContainText('(143)');
  await page.getByRole('button',{name:'Ver 30 selecciones más'}).click();await expect(cards).toHaveCount(60);
  await page.getByLabel('Período').selectOption('q1');
  const game=board.preferredRows.periods.find((r:any)=>r.period==='q1');
  await page.getByLabel('Partido',{exact:true}).selectOption(String(game.gameId));
  const expected=board.preferredRows.periods.filter((r:any)=>r.gameId===game.gameId&&r.period==='q1');
  await expect(cards).toHaveCount(expected.length);
  for(const text of await cards.allTextContents()){expect(text).toContain(game.matchup);expect(text).toContain('1Q');}
  await page.getByLabel('Buscar jugador, mercado o equipo').fill('no-such-team');
  await expect(cards).toHaveCount(0);
  await checkWidth();
});
