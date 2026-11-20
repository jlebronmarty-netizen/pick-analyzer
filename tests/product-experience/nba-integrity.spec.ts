import {test,expect} from '@playwright/test';
import {buildNbaDecisionBoard} from '../../src/lib/nba/decision-board-core.mjs';
import {inputs,before,after} from '../fixtures/nba-shead-inputs.mjs';

test('six NBA views, Shead evidence across refresh, and read failure clears stale values',async({page})=>{
  const snapshots=[before,after].map(asOf=>buildNbaDecisionBoard(inputs(asOf)));
  let read=0;
  await page.route('**/api/nba/decision-board',route=>{
    const response=snapshots[read++];
    return response?route.fulfill({json:response}):route.fulfill({status:503,json:{status:'SOURCE_UNAVAILABLE'}});
  });
  await page.route('**/api/nba/decision-learning',route=>route.fulfill({status:503,json:{}}));
  await page.goto('/nba-decision-board');
  const tabs=page.getByRole('navigation',{name:'Mercados NBA'});
  for(const name of ['Top 25','Moneyline','Spread','Total','Player props','Cuartos / Mitades']){
    await tabs.getByRole('button',{name:new RegExp('^'+name)}).click();
    await expect(page.locator('h2').filter({hasText:name})).toBeVisible();
  }
  await tabs.getByRole('button',{name:/^Player props/}).click();
  await page.getByText('Datos pendientes de validación',{exact:true}).click();
  const row=page.locator('article').filter({hasText:'Jamal Shead'});
  await expect(row).toContainText('INCOMPLETE_HISTORY');
  await row.getByRole('button',{name:'Ver contexto'}).click();
  await expect(row).toContainText('21718136');
  await page.getByRole('button',{name:'Actualizar sin consumir API'}).click();
  await expect(page.getByRole('button',{name:'Actualizar sin consumir API'})).toBeEnabled();
  if(!await row.isVisible())await page.getByText('Datos pendientes de validación',{exact:true}).click();
  await expect(row).toContainText('5.4/7.2');
  await expect(row).toContainText('6.03');
  await expect(row).toContainText('PASAR');
  await page.getByRole('button',{name:'Actualizar sin consumir API'}).click();
  await expect(page.getByRole('alert').filter({hasText:'SOURCE_UNAVAILABLE'})).toBeVisible();
  await expect(page.locator('article').filter({hasText:'Jamal Shead'})).toHaveCount(0);
});
