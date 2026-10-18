import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../../docs/images/', import.meta.url));
await mkdir(directory,{recursive:true});
const browser = await chromium.launch();
const sessionIds = [];
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}, deviceScaleFactor:1});
  const page = await context.newPage();
  page.on('response',async response=>{
    if(response.url().endsWith('/api/sessions') && response.request().method()==='POST' && response.ok()) sessionIds.push((await response.json()).id);
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:8765/');
  await page.getByRole('button',{name:'Explore the demo'}).waitFor({state:'visible'});
  await expect(page.getByRole('button',{name:'Explore the demo'})).toBeEnabled();
  await page.screenshot({path:directory+'overview.png'});
  await page.getByRole('button',{name:'Explore the demo'}).click();
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await page.getByRole('button',{name:/Identical features across splits/}).waitFor({state:'visible'});
  await page.locator('.settings-panel').screenshot({path:directory+'column-selection.png'});
  await page.getByRole('button',{name:'Split risks',exact:true}).click();
  await page.getByRole('button',{name:/Shared subjects: subject_id/}).click();
  await page.locator('#findings').scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.getElementById('findings').scrollIntoView({block:'start'}));
  await page.screenshot({path:directory+'health-report.png'});
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await page.getByText('Up to date',{exact:true}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Dismiss notification'}).click();
  await page.evaluate(()=>document.getElementById('cleaning').scrollIntoView({block:'start'}));
  await page.screenshot({path:directory+'cleaning-studio.png'});
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:8765/');
  await page.getByRole('heading',{name:/A little clarity/}).waitFor();
  await expect(page.getByRole('button',{name:'Explore the demo'})).toBeEnabled();
  await page.screenshot({path:directory+'mobile.png'});
  console.log('Saved five screenshots of the real running application.');
} finally {
  for(const id of sessionIds) await fetch(`http://127.0.0.1:8765/api/sessions/${id}`,{method:'DELETE'}).catch(()=>{});
  await browser.close();
}
