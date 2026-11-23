import {test,expect} from '@playwright/test';
import {buildNbaVersionReport} from '../../src/lib/nba/model-version-evidence';
import {buildNbaDecisionBoard} from '../../src/lib/nba/decision-board-core.mjs';
import {inputs,before} from '../fixtures/nba-shead-inputs.mjs';

// Representative historical cohorts; all browser API responses are intercepted.
const original='nba_prediction_engine_v1',corrected='nba_prediction_engine_v1_1_inputs_shadow';
const row=(id:string,game:number,model:string,market:string,result:string)=>({
 id,game_id:String(game),model_version:model,market,result,model_probability:null,
 generated_at:model===original?'2026-11-22T00:30:00Z':'2026-11-22T01:00:00Z',
 created_at:model===original?'2026-11-22T00:30:00Z':'2026-11-22T01:00:00Z',
 commence_time:'2026-11-22T03:00:00Z',settled_at:'2026-11-22T06:00:00Z',
 recommended_pick:false,production_eligible:false,
});
const historicalRows=[
 ...Array.from({length:49},(_,i)=>row('ml'+i,i,original,'moneyline',i<33?'win':'loss')),
 ...Array.from({length:27},(_,i)=>row('sp'+i,29+i%26,original,'spread',i<13?'win':'loss')),
 ...Array.from({length:17},(_,i)=>row('to'+i,39+i%16,original,'total',i<8?'win':'loss')),
 ...['moneyline','spread','total'].map((market,i)=>row('new'+i,55,corrected,market,'loss')),
];
const report={...buildNbaVersionReport(historicalRows),checked_at:'2026-11-22T23:28:49.905Z'};
const status={
 checked_at:'2026-11-22T23:31:40.280Z',season:2026,gate:{allowed:true,blockers:[]},
 rows_emitted_date_local:'2026-11-22',rows_emitted_time_zone:'America/Puerto_Rico',
 rows_emitted_today:0,daily_row_cap:9,rows_remaining_today:9,next_daily_reset_at:'2026-11-23T04:00:00Z',
 last_prediction_created_at:'2026-11-22T01:00:00Z',fresh_pregame_quotes:30,verified_contract_quotes:30,
 team_stats_rows:30,team_stats_fresh:true,goat_shadow_pending:0,legacy_shadow_pending:0,
};

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
 test(`NBA board is discoverable from home and navigation on ${viewport.name}`,async({page},testInfo)=>{
  await page.setViewportSize(viewport);
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'TEST_READ_UNAVAILABLE'}}));
  await page.route('**/api/nba/decision-board',route=>route.fulfill({json:buildNbaDecisionBoard(inputs(before))}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Deportes',exact:true,level:1})).toBeVisible();
  const cta=page.locator('[data-sport-card="nba"]').getByRole('link',{name:'Abrir NBA: análisis y mercados',exact:true});
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href','/nba-decision-board');
  const sports=page.getByRole('navigation',{name:'Deportes',exact:true});
  await expect(sports.getByRole('link',{name:'NBA',exact:true})).toHaveAttribute('href','/nba-decision-board');
  await page.getByText('Historial, aprendizaje y estado',{exact:true}).click();
  const tools=page.getByRole('navigation',{name:'Historial y herramientas por deporte'});
  await expect(tools.getByRole('link',{name:'NBA · Archivo GOAT',exact:true})).toHaveAttribute('href','/nba-market-data');
  await expect(tools.getByRole('link',{name:'NBA Learning',exact:true})).toHaveAttribute('href','/nba-learning');
  await page.getByText('Historial, aprendizaje y estado',{exact:true}).click();
  if(viewport.name==='mobile'){
   await expect(page.getByRole('navigation',{name:'Navegación principal móvil'}).getByRole('link',{name:'Deportes',exact:true})).toBeVisible();
  }else{
   await expect(page.getByRole('navigation',{name:'Navegación principal',exact:true}).getByRole('link',{name:'Deportes',exact:true})).toBeVisible();
  }
  await page.screenshot({path:testInfo.outputPath(`nba-home-${viewport.name}.png`),fullPage:false});
  await cta.click();
  await expect(page).toHaveURL(/\/nba-decision-board$/);
  const currentNavigation=page.getByRole('navigation',{name:viewport.name==='mobile'?'Navegación principal móvil':'Navegación principal',exact:true});
  await expect(currentNavigation.getByRole('link',{name:'Board NBA',exact:true})).toBeVisible();
  const tabs=page.getByRole('navigation',{name:'Mercados NBA'});
  for(const name of ['Top 25','Moneyline','Spread','Total','Player props','Cuartos / Mitades']){
   await expect(tabs.getByRole('button',{name:new RegExp('^'+name)})).toBeVisible();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 });

 test(`GOAT preserves versions and clears failed reads on ${viewport.name}`,async({page},testInfo)=>{
  await page.setViewportSize(viewport);
  let reportFails=false,statusFails=false;
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'TEST_READ_UNAVAILABLE'}}));
  await page.route('**/api/market-data/nba?**',route=>route.fulfill({json:{data:{games:[]}}}));
  await page.route('**/api/market-data/nba/model-report',route=>route.fulfill(reportFails?{status:503,json:{error:'TEST_READ_UNAVAILABLE'}}:{json:report}));
  await page.route('**/api/market-data/nba/model-status',route=>route.fulfill(statusFails?{status:503,json:{error:'TEST_READ_UNAVAILABLE'}}:{json:status}));
  await page.goto('/nba-market-data');
  await expect(page.locator('main#main-content')).toHaveCount(1);
  await expect(page.getByRole('link',{name:'Abrir Decision Board NBA',exact:true})).toBeVisible();
  const history=page.getByRole('region',{name:'Selecciones NBA GOAT SHADOW'});
  const versions=history.getByRole('region',{name:'Historial disponible por versión'});
  await expect(versions).toContainText('55 juegos únicos · 93 contratos');
  await expect(versions).toContainText('1 juegos únicos · 3 contratos');
  await expect(history.getByLabel('Versión NBA SHADOW')).toHaveValue(corrected);
  await versions.getByRole('button',{name:/^Histórico · v1/}).click();
  await expect(history.getByLabel('Versión NBA SHADOW')).toHaveValue(original);
  await expect(history).toContainText('33 W / 16 L');
  await history.getByRole('button',{name:'Actualizar historial',exact:true}).click();
  await expect(history.getByRole('button',{name:'Actualizar historial',exact:true})).toBeEnabled();
  await expect(history.getByLabel('Versión NBA SHADOW')).toHaveValue(original);
  const operation=page.getByRole('region',{name:'Conexión GOAT y estado del modelo'});
  await expect(operation).toContainText('2026-11-22');
  await expect(operation).toContainText('0 / 9');
  await expect(operation).toContainText('No se han almacenado pronósticos GOAT en esta jornada');
  await expect(operation).toContainText('Última emisión almacenada · GOAT');
  await expect(operation).toContainText('Lectura del estado');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`nba-goat-${viewport.name}.png`),fullPage:true});
  reportFails=true;
  await history.getByRole('button',{name:'Actualizar historial',exact:true}).click();
  await expect(history.getByRole('alert')).toContainText('Reporte SHADOW no verificado');
  await expect(versions).toHaveCount(0);
  await expect(history).not.toContainText('33 W / 16 L');
  statusFails=true;
  await operation.getByRole('button',{name:'Verificar conexión del modelo',exact:true}).click();
  await expect(operation.getByRole('alert')).toContainText('se retiró la lectura anterior');
  await expect(operation).not.toContainText('0 / 9');
  await expect(operation).not.toContainText('Requisitos disponibles para la próxima ejecución');
 });
}
