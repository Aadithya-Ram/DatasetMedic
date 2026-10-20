import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {execFileSync} from 'node:child_process';

const python=process.env.DATASETMEDIC_PYTHON || '../.venv/Scripts/python';
const report=execFileSync(python,['-c',`
import polars as pl
from datasetmedic.engine import audit,render_report
frame=pl.DataFrame({'subject':['S1','S1','S2'],'city':['東京','東京',None],'flag':[False,False,True]})
frame=frame.with_columns([pl.lit('demo').alias(f'feature_{index}') for index in range(6)])
print(render_report(audit({'source':frame},{}),{'source':'Synthetic <dataset>.csv'},cleaned=True))
`],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});

test('standalone report supports keyboard navigation, accessible evidence and narrow screens',async({page})=>{
  const requests:string[]=[];
  await page.route('**/*',async route=>{
    requests.push(route.request().url());
    if(route.request().url().endsWith('/standalone-report')) await route.fulfill({contentType:'text/html',body:report});
    else await route.abort();
  });
  await page.goto('/standalone-report');
  await expect(page.getByRole('heading',{name:'Dataset health report',exact:true})).toBeVisible();
  await expect(page.getByText('Synthetic <dataset>.csv',{exact:true})).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to report'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('table',{name:'Column profile for Synthetic <dataset>.csv'})).toBeVisible();
  await expect(page.getByRole('cell',{name:'"東京"',exact:true}).first()).toBeVisible();
  await expect(page.getByRole('cell',{name:'false',exact:true}).first()).toBeVisible();
  await expect(page.getByRole('cell',{name:'Missing',exact:true}).first()).toBeVisible();
  await expect(page.getByText('Wide examples are listed field-by-field.',{exact:true}).first()).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const region=page.getByRole('region',{name:'Column profile for Synthetic <dataset>.csv'});
  await region.focus();await expect(region).toBeFocused();
  await page.emulateMedia({media:'print'});
  await expect(page.getByRole('heading',{name:'Dataset health report',exact:true})).toBeVisible();
  expect(requests).toEqual(['http://127.0.0.1:8765/standalone-report']);
});
