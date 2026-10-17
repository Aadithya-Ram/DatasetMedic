import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch();
let sid;
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  page.on('response',async response=>{
    if(response.url().endsWith('/api/sessions') && response.request().method()==='POST' && response.ok()) sid=(await response.json()).id;
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:8765/');
  const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  console.log(JSON.stringify(results.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),null,2));
  if (results.violations.length) process.exitCode=1;
} finally {
  if(sid) await fetch(`http://127.0.0.1:8765/api/sessions/${sid}`,{method:'DELETE'}).catch(()=>{});
  await browser.close();
}
