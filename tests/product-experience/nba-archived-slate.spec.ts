import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// Replay stored board responses locally. The records stay outside Git.
const slates=[
  {day:'2026-11-20',path:process.env.NBA_ARCHIVED_SLATE_FILE,asOf:'2026-11-20T23:35:00Z',periods:143},
  {day:'2026-11-23',path:process.env.NBA_ARCHIVED_SLATE_20261123_FILE,asOf:'2026-11-23T21:30:25.852Z',periods:169},
];
for(const {day,path,asOf,periods} of slates)test(`NBA slate ${day} preserves six views, evidence, order, paging and mobile layout`,async({page})=>{
  test.skip(!path,`Requires the archived ${day} board response.`);
  const board=JSON.parse(readFileSync(path!,'utf8'));
  expect(Date.parse(board.asOf)).toBe(Date.parse(asOf));
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
  for(const [name,key] of [['Moneyline','ml'],['Spread','spread'],['Total','total'],['Player props','props']]){
    await switchTab(name);
    const panel=page.locator('details').filter({has:page.getByText('Datos pendientes de validación',{exact:true})});
    await expect(panel).toHaveJSProperty('open',true);
    await expect(page.locator('h2').filter({hasText:name})).toContainText(`(0) preferencias vigentes · ${board.rows[key].length} lados capturados`);
    await expect(cards).toHaveCount(Math.min(30,board.rows[key].length));
    await expect(page.locator('article:visible').filter({hasText:'PREFERENCIA SHADOW'})).toHaveCount(0);
    await expect(cards.first()).toBeVisible();await expect(cards.first()).toContainText('Precio capturado');
    await expect(cards.first()).toContainText('FanDuel');
    await checkWidth();await panel.locator('summary').click();
  }
  await switchTab('Cuartos / Mitades');await expect(cards).toHaveCount(30);
  await expect(page.locator('h2').filter({hasText:'Cuartos / Mitades'})).toContainText(`(${periods})`);
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
