import {test,expect} from '@playwright/test';

for(const width of [390,1440]){
  test(`Cheat Sheets filters archived milestones and both rankings at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/nba-sheet-band-fixture');
    const card=page.getByRole('article').filter({hasText:'Jugador de prueba'});
    await expect(card).toContainText('9/10');
    await page.getByRole('button',{name:'Últimos 5',exact:true}).click();
    await expect(card).toContainText('4/5');
    await page.getByRole('button',{name:'−250 o mejor',exact:true}).click();
    await expect(card).toHaveCount(0);
    await page.getByRole('button',{name:'−251 a −650',exact:true}).click();
    await expect(card).toBeVisible();
    await expect(card).toContainText('#1');
    await expect(page.getByText('Sin tarjetas para estos filtros')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Top histórico · Puntos · −251 a −650'})).toBeVisible();
    await page.getByRole('button',{name:'Ambos rangos',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Top 10 verificado · Puntos',exact:true})).toHaveCount(1);
    await page.getByRole('button',{name:'Rebotes',exact:true}).click();
    await expect(card).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
