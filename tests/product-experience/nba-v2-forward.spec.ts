import {test,expect} from '@playwright/test';
test('SHADOW daily review filters graded and pending contracts and preserves the challenge balance',async({page})=>{
 await page.goto('/nba-decision-v2');
 await expect(page.getByRole('heading',{name:'Evaluación prospectiva V2'})).toBeVisible();
 await expect(page.getByLabel('Challenge')).toContainText('$187.94');
 await expect(page.getByLabel('Challenge')).toContainText('SIN APUESTA');
 await page.getByLabel('Jornada PR').selectOption('2026-11-20');
 await expect(page.locator('details')).toHaveCount(15);
 await page.getByLabel('Resultado',{exact:true}).selectOption('win');await expect(page.locator('details')).toHaveCount(6);
 await page.locator('summary').first().click();
 await expect(page.locator('details').first()).toContainText('Probabilidad V2');
 await expect(page.locator('details').first()).toContainText('Historial VALIDATED');
 await expect(page.locator('details').first()).toContainText('Precio del operador');
 await page.getByLabel('Jornada PR').selectOption('2026-11-21');
 await expect(page.getByText('No hay contratos con estos filtros.')).toBeVisible();
 await page.getByLabel('Resultado',{exact:true}).selectOption('pending');await expect(page.locator('details')).toHaveCount(25);
 await expect(page.getByLabel('Validación por mercado')).toContainText('SIN DATOS');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
