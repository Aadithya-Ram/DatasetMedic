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
  const names=Array.from({length:50},(_,index)=>`signal_${String(index+1).padStart(2,'0')}`);
  const csv=[names.join(','),names.map((_,index)=>index).join(','),names.map((_,index)=>index%2?'':index+1).join(','),names.map((_,index)=>index+2).join(',')].join('\n');
  await page.locator('#file-import').setInputFiles({name:'synthetic-signals.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/result') && response.ok()),page.getByRole('button',{name:'Run health check',exact:true}).click()]);
  const profiles=page.getByRole('region',{name:'Column profiles',exact:true});
  await profiles.getByRole('button',{name:'With missing values'}).click();
  await expect(profiles.getByRole('status')).toHaveText('1–24 of 25 matching columns · 50 total');
  await page.locator('.profile-panel').first().screenshot({path:fileURLToPath(new URL('../../docs/images/column-profiles.png',import.meta.url))});
  console.log('Captured real column profiles from a synthetic 50-column CSV audit.');
} finally {
  for(const id of sessions) await context.request.delete(`http://127.0.0.1:8765/api/sessions/${id}`,{headers:{'X-DatasetMedic':'1'}});
  await browser.close();
}
