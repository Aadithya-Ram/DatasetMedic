import {chromium, expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const browser=await chromium.launch();
const sessions=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
try {
  const page=await context.newPage();
  page.on('response',async response=>{
    if(response.url().endsWith('/api/sessions') && response.request().method()==='POST' && response.ok()) sessions.push((await response.json()).id);
  });
  await page.goto('http://127.0.0.1:8765/');
  await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeEnabled();
  const columns=Array.from({length:30},(_,index)=>`measurement_${String(index+1).padStart(2,'0')}`);
  const row=columns.map(()=>1).join(',');
  await page.locator('#file-import').setInputFiles({name:'synthetic-measurements.csv',mimeType:'text/csv',buffer:Buffer.from(`${columns.join(',')}\n${row}\n${row}\n`)});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('1–20 of 31 matching findings');
  await page.getByRole('textbox',{name:'Search all findings'}).fill('measurement_30');
  await page.getByRole('button',{name:'Observations',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('1–1 of 1 matching findings · 31 total');
  await page.getByRole('button',{name:/Constant or empty column: measurement_30/}).click();
  await page.evaluate(()=>document.getElementById('findings').scrollIntoView({block:'start'}));
  await page.screenshot({path:fileURLToPath(new URL('../../docs/images/findings-search.png',import.meta.url))});
  console.log('Captured full-audit search in a real synthetic 31-finding audit.');
} finally {
  for(const id of sessions) await context.request.delete(`http://127.0.0.1:8765/api/sessions/${id}`,{headers:{'X-DatasetMedic':'1'}});
  await browser.close();
}
