import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

async function auditManyFindings(page: Page) {
  await openWorkbench(page);
  const names=[...Array.from({length:30},(_,i)=>`field_${String(i).padStart(2,'0')}`),'東京'];
  const row=names.map(()=>1).join(',');
  await page.locator('#file-import').setInputFiles({name:'many-findings.csv',mimeType:'text/csv',buffer:Buffer.from(`${names.join(',')}\n${row}\n${row}\n`)});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('1–20 of 32 matching findings');
}

test('findings search and severity filters cover every page of the audit',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await auditManyFindings(page);
  await page.getByRole('button',{name:'Next findings page'}).click();
  await expect(page.locator('.pagination')).toContainText('21–32 of 32 matching findings');
  await page.getByRole('button',{name:'Observations',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('1–20 of 31 matching findings');
  await page.getByRole('textbox',{name:'Search all findings'}).fill('FIELD_29');
  await expect(page.getByRole('button',{name:/Constant or empty column: field_29/})).toBeVisible();
  await expect(page.locator('.pagination')).toContainText('1–1 of 1 matching findings · 32 total');
  await page.getByRole('textbox',{name:'Search all findings'}).fill('東京');
  await expect(page.getByRole('button',{name:/Constant or empty column: 東京/})).toBeVisible();
  await page.getByRole('button',{name:'Attention',exact:true}).click();
  await expect(page.getByText('No findings match these filters.',{exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Search all findings'}).fill('');
  await expect(page.getByRole('button',{name:/Repeated records/})).toBeVisible();
  await expect(page.locator('.findings-list article')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Next findings page'})).toBeDisabled();
  expect((await new AxeBuilder({page}).include('#findings').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Update health check'}).click();
  await expect(page.getByRole('textbox',{name:'Search all findings'})).toHaveValue('');
  await expect(page.getByRole('button',{name:'All findings',pressed:true})).toBeVisible();
});

test('obsolete findings requests cannot replace new filters and failed requests can retry',async({page})=>{
  await auditManyFindings(page);
  let release!:()=>void, started!:()=>void, finished!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const requested=new Promise<void>(resolve=>{started=resolve;});
  const handled=new Promise<void>(resolve=>{finished=resolve;});
  let fail=true;
  await page.route('**/findings?*',async route=>{
    const query=new URL(route.request().url()).searchParams.get('query');
    if(query==='field_0') {
      const response=await route.fetch();started();await gate;
      try {await route.fulfill({response});} catch { /* The obsolete fetch may already be aborted. */ }
      finally {finished();}
    } else if(query==='broken'&&fail) {fail=false;await route.fulfill({status:503,body:'Unavailable'});}
    else await route.continue();
  });
  try {
    await page.getByRole('textbox',{name:'Search all findings'}).fill('field_0');
    await requested;
    await expect(page.locator('.pagination')).toContainText('Loading findings');
    await expect(page.locator('.findings-list article')).toHaveCount(0);
    await expect(page.getByText('No findings match these filters.',{exact:true})).toHaveCount(0);
    await page.getByRole('textbox',{name:'Search all findings'}).fill('field_29');
    await expect(page.getByRole('button',{name:/Constant or empty column: field_29/})).toBeVisible();
  } finally {release();await handled;}
  await expect(page.locator('.findings-list article')).toHaveCount(1);
  await page.getByRole('textbox',{name:'Search all findings'}).fill('broken');
  await expect(page.getByRole('alert')).toContainText('Could not load findings');
  await expect(page.getByText('No findings match these filters.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Retry findings',exact:true}).click();
  await expect(page.getByText('No findings match these filters.',{exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('500-column profiles support filtered pagination and reset between datasets and audits',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await openWorkbench(page);
  const names=[...Array.from({length:498},(_,i)=>`field_${String(i).padStart(3,'0')}`),'東京尺度','all_empty'];
  const csv=[names.join(','),names.map((_,i)=>i===499?'':i===498?'東京':String(i)).join(','),names.map((_,i)=>i>=498||i%2?'':String(i+1)).join(',')].join('\n');
  await page.locator('#file-import').setInputFiles([
    {name:'wide-profiles.csv',mimeType:'text/csv',buffer:Buffer.from(csv)},
    {name:'other.csv',mimeType:'text/csv',buffer:Buffer.from('code,value\nA,1\nB,2\n')},
  ]);
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/result') && response.ok()), page.getByRole('button',{name:'Run health check',exact:true}).click()]);
  const profiles=page.getByRole('region',{name:'Column profiles',exact:true});
  await expect(profiles.getByRole('status')).toHaveText('1–24 of 500 matching columns · 500 total');
  await expect(profiles.getByRole('article')).toHaveCount(24);
  await profiles.getByRole('button',{name:'Next column page'}).focus();
  await page.keyboard.press('Enter');
  await expect(profiles.getByRole('button',{name:'Next column page'})).toBeFocused();
  await expect(profiles.getByRole('status')).toHaveText('25–48 of 500 matching columns · 500 total');
  await expect(profiles.getByRole('article',{name:'Column field_024',exact:true})).toBeVisible();
  await profiles.getByRole('button',{name:'With missing values'}).click();
  await expect(profiles.getByRole('button',{name:'With missing values',pressed:true})).toBeVisible();
  await expect(profiles.getByRole('status')).toHaveText('1–24 of 251 matching columns · 500 total');
  await profiles.getByRole('textbox',{name:'Search column profiles'}).fill('FIELD_497');
  await expect(profiles.getByRole('article',{name:'Column field_497',exact:true})).toContainText('1 missing');
  await expect(profiles.getByRole('status')).toHaveText('1–1 of 1 matching columns · 500 total');
  await expect(profiles.getByRole('button',{name:'Next column page'})).toBeDisabled();
  await profiles.getByRole('textbox',{name:'Search column profiles'}).fill('東京');
  await expect(profiles.getByRole('article',{name:'Column 東京尺度',exact:true})).toBeVisible();
  await profiles.getByRole('textbox',{name:'Search column profiles'}).fill('all_empty');
  await expect(profiles.getByRole('article',{name:'Column all_empty',exact:true})).toContainText('2 missing');
  await profiles.getByRole('textbox',{name:'Search column profiles'}).fill('no_such_column');
  await expect(profiles.getByRole('article')).toHaveCount(0);
  await expect(profiles.getByText(/No column names match/)).toBeVisible();
  expect((await new AxeBuilder({page}).include('.column-profiles').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await profiles.getByRole('button',{name:'Reset column filters'}).click();
  await expect(profiles.getByRole('status')).toHaveText('1–24 of 500 matching columns · 500 total');
  expect((await new AxeBuilder({page}).include('.column-profiles').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await profiles.getByRole('textbox',{name:'Search column profiles'}).fill('all_empty');
  await page.getByLabel('Dataset to inspect').selectOption({label:'other.csv'});
  await expect(profiles.getByRole('textbox',{name:'Search column profiles'})).toHaveValue('');
  await expect(profiles.getByRole('status')).toHaveText('1–2 of 2 matching columns · 2 total');
  await profiles.getByRole('button',{name:'With missing values'}).click();
  await expect(profiles.getByRole('status')).toHaveText('0 matching columns · 2 total');
  await page.getByLabel('Dataset to inspect').selectOption({label:'wide-profiles.csv'});
  await expect(profiles.getByRole('button',{name:'With missing values',pressed:false})).toBeVisible();
  await profiles.getByRole('textbox',{name:'Search column profiles'}).fill('東京');
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/result') && response.ok()), page.getByRole('button',{name:'Update health check'}).click()]);
  await expect(profiles.getByRole('textbox',{name:'Search column profiles'})).toHaveValue('');
  await expect(profiles.getByRole('status')).toHaveText('1–24 of 500 matching columns · 500 total');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByText('Preview source records',{exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'field_497',exact:true})).toHaveCount(1);
});

test('failed recipe preview identifies its step and opens that step for repair',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'repair.csv',mimeType:'text/csv',buffer:Buffer.from('code,noise\nA1,1\n,2\nA1,3\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add recipe step'})).toBeEnabled();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByLabel('What would you like to do?').selectOption('fill');
  await page.getByRole('group',{name:'Choose columns',exact:true}).getByRole('button',{name:'code',exact:true}).click();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByRole('alert')).toContainText('Step 2 (fill): Median requires numeric values: code');
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeDisabled();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Edit step 2',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('What would you like to do?')).toBeFocused();
  await expect(page.getByLabel('Fill strategy')).toHaveValue('median');
  await page.getByLabel('Fill strategy').selectOption('mode');
  await page.getByRole('button',{name:'Save step changes'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeEnabled();
  await page.getByText('See the resulting records and fitted values',{exact:true}).click();
  const row=page.locator('.preview-records tbody tr').filter({has:page.getByRole('cell',{name:'2',exact:true})});
  await expect(row.getByRole('cell',{name:'A1',exact:true})).toBeVisible();
});

test('recipe error edit links disappear when their recorded recipe changes',async({page})=>{
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'stale-error.csv',mimeType:'text/csv',buffer:Buffer.from('code,noise\nA,1\nB,2\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add recipe step'})).toBeEnabled();
  await page.getByLabel('What would you like to do?').selectOption('drop');
  await page.getByRole('group',{name:'Choose columns',exact:true}).getByRole('button',{name:'noise',exact:true}).click();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByLabel('What would you like to do?').selectOption('fill');
  await page.getByRole('group',{name:'Choose columns',exact:true}).getByRole('button',{name:'noise',exact:true}).click();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByRole('alert')).toContainText('Step 2 (fill)');
  await expect(page.getByRole('button',{name:'Edit step 2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Remove recipe step 1'}).click();
  await expect(page.getByRole('button',{name:'Edit step 2',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
});

test('split summaries preserve tiny missing rates, false values and non-finite numeric evidence',async({page})=>{
  await openWorkbench(page);
  const training='value,flag,tiny\n,false,1e-9\n'+Array(2000).fill('0,false,1e-9\n').join('');
  await page.locator('#file-import').setInputFiles([
    {name:'large.csv',mimeType:'text/csv',buffer:Buffer.from(training)},
    {name:'small.csv',mimeType:'text/csv',buffer:Buffer.from('value,flag,tiny\ninf,false,1e-9\n-inf,false,1e-9\n')},
  ]);
  await page.getByLabel('Split role for large.csv').selectOption('train');
  await page.getByLabel('Split role for small.csv').selectOption('test');
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  const table=page.locator('.split-comparisons').getByRole('table');
  const value=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^value/})});
  await expect(value.getByRole('cell').nth(0)).toHaveText('<0.1%1 / 2,001 rows');
  await expect(value.getByRole('cell').nth(3)).toHaveText('No finite numeric values');
  const flag=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^flag/})});
  await expect(flag.getByRole('cell').nth(3)).toContainText('Most frequent: false');
  await expect(flag.getByRole('cell').nth(3)).toContainText('2 / 2 rows · 100%');
  const tiny=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^tiny/})});
  await expect(tiny.getByRole('cell').nth(3)).toContainText('Mean: 1E-9');
});

test('split comparisons use each split denominator and label summaries and type differences',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles([
    {name:'training.csv',mimeType:'text/csv',buffer:Buffer.from('value,city,mixed\n0,Pune,1\n0,Pune,2\n1,Pune,3\n-1,Pune,4\n,Pune,5\n,,6\n2,,7\n-2,,8\n')},
    {name:'evaluation.csv',mimeType:'text/csv',buffer:Buffer.from('value,city,mixed\n0,,a\n0,,b\n,,c\n,,d\n')},
  ]);
  await page.getByLabel('Split role for training.csv').selectOption('train');
  await page.getByLabel('Split role for evaluation.csv').selectOption('test');
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  const panel=page.locator('.split-comparisons');
  await expect(panel).toContainText('training.csv: 8 rows · evaluation.csv: 4 rows · 3 common columns');
  const table=panel.getByRole('table');
  await expect(table.getByRole('columnheader',{name:'training.csv missing',exact:true})).toBeVisible();
  const value=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^value/})});
  await expect(value.getByRole('cell').nth(0)).toHaveText('25%2 / 8 rows');
  await expect(value.getByRole('cell').nth(1)).toHaveText('50%2 / 4 rows');
  await expect(value.getByRole('cell').nth(2)).toContainText('Mean: 0');
  await expect(value.getByRole('cell').nth(2)).toContainText('Median: 0');
  const city=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^city/})});
  await expect(city.getByRole('cell').nth(2)).toContainText('Most frequent: "Pune"');
  await expect(city.getByRole('cell').nth(3)).toContainText('Most frequent: Missing value');
  await expect(city.getByRole('cell').nth(3)).toContainText('4 / 4 rows · 100%');
  const mixed=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^mixed/})});
  await expect(mixed.getByRole('rowheader')).toContainText('Types differ: Int64 / String');
  await expect(panel).toContainText('not statistical drift tests');
  const region=panel.getByRole('region');
  await region.focus();await expect(region).toBeFocused();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

// setInputFiles does not wait for an enabled input. Wait for the local session,
// just as a user must before opening the file picker.
async function openWorkbench(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeEnabled();
}

test('delayed local session keeps import controls disabled until ready',async({page})=>{
  let release!: ()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let imports=0;
  page.on('request',request=>{if(request.url().endsWith('/imports'))imports++;});
  await page.route('**/api/sessions',async route=>{await gate;await route.continue();});
  const opening=openWorkbench(page);
  try {
    await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeDisabled();
    await expect(page.locator('#file-import')).toBeDisabled();
    expect(imports).toBe(0);
  } finally {release();await opening;}
  await page.locator('#file-import').setInputFiles({name:'after-startup.csv',mimeType:'text/csv',buffer:Buffer.from('x\n1\n')});
  await expect(page.locator('.dataset-name strong')).toHaveText('after-startup.csv');
  expect(imports).toBe(1);
});

test('import preflight rejects a whole invalid batch without sending files',async({page})=>{
  let uploads=0;
  page.on('request',request=>{if(request.url().endsWith('/imports')) uploads++;});
  await openWorkbench(page);
  await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeEnabled();
  const valid={name:'valid.CSV',mimeType:'text/csv',buffer:Buffer.from('x\n1\n')};
  await page.locator('#file-import').setInputFiles([valid,{name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('hello')}]);
  await expect(page.getByRole('alert')).toContainText('No files from this batch were imported. “notes.txt” is not a CSV or Parquet file.');
  expect(uploads).toBe(0);
  await page.locator('#file-import').setInputFiles({name:'empty.csv',mimeType:'text/csv',buffer:Buffer.from('')});
  await expect(page.getByRole('alert')).toContainText('“empty.csv” is empty');
  expect(uploads).toBe(0);
  await page.locator('.import-panel').evaluate(element=>{
    const file=new File(['x\n1\n'],'oversized.csv',{type:'text/csv'});
    Object.defineProperty(file,'size',{value:250*1024*1024+1});
    const transfer=new DataTransfer(); transfer.items.add(file);
    element.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
  });
  await expect(page.getByRole('alert')).toContainText('exceeds the 250 MiB per-file limit');
  expect(uploads).toBe(0);
  await page.locator('#file-import').setInputFiles(valid);
  await expect(page.locator('.dataset-name strong')).toHaveText('valid.CSV');
  await page.locator('#file-import').setInputFiles([valid,valid,valid]);
  await expect(page.getByRole('alert')).toContainText('exceed 3 datasets per session (1 already imported)');
  expect(uploads).toBe(1);
  await expect(page.locator('.dataset-name strong')).toHaveText('valid.CSV');
  await expect(page.getByRole('button',{name:'Run health check',exact:true})).toBeEnabled();
});

test('import progress and partial failures preserve successful files and permit retry',async({page,request})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  let release!: ()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let uploads=0;
  await page.route('**/imports',async route=>{
    uploads++;
    if(uploads===1) {await gate; await route.continue();}
    else await route.fulfill({status:413,contentType:'application/json',body:JSON.stringify({detail:'Synthetic import failure'})});
  });
  await openWorkbench(page);
  await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeEnabled();
  const files=['first.csv','second.csv','third.csv'].map(name=>({name,mimeType:'text/csv',buffer:Buffer.from('city\nPune\n')}));
  await page.locator('#file-import').setInputFiles(files);
  const progress=page.getByRole('status').filter({hasText:'Importing file 1 of 3'});
  try {
    await expect(progress).toContainText('first.csv');
    await expect(progress).toContainText('10 bytes');
    await expect(page.locator('.job-bar')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Choose files',exact:true})).toBeDisabled();
    await expect(page.getByLabel('CSV delimiter')).toBeDisabled();
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {release();}
  await expect(page.getByRole('alert')).toContainText('1 of 3 files imported before “second.csv” failed: Synthetic import failure');
  expect(uploads).toBe(2);
  await expect(progress).toHaveCount(0);
  await expect(page.locator('.dataset-name strong')).toHaveText('first.csv');
  const id=sessions.get(page)?.[0];
  expect((await (await request.get(`/api/sessions/${id}/datasets`)).json()).map((item:{name:string})=>item.name)).toEqual(['first.csv']);
  await page.unroute('**/imports');
  await page.locator('#file-import').setInputFiles(files.slice(1));
  await expect(page.locator('.dataset-name strong')).toHaveText(['first.csv','second.csv','third.csv']);
  await expect(page.getByRole('status').filter({hasText:'2 files imported.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Run health check',exact:true})).toBeEnabled();
});

test('wide column search retains selections across filters and cleaning',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openWorkbench(page);
  const columns=['Subject_ID','城市',...Array.from({length:498},(_,i)=>`feature_${i}`)];
  await page.locator('#file-import').setInputFiles({name:'search.csv',mimeType:'text/csv',buffer:Buffer.from(columns.join(',')+'\n'+columns.map(()=>1).join(',')+'\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  const groups=page.getByRole('group',{name:'Subject / group columns',exact:true});
  const search=groups.getByRole('searchbox');
  await search.fill('subject');
  const subject=groups.getByRole('button',{name:'Subject_ID',exact:true});
  await subject.focus(); await page.keyboard.press('Space');
  await search.fill('城市');
  await groups.getByRole('button',{name:'城市',exact:true}).click();
  await expect(groups.getByRole('status')).toHaveText('1 of 500 columns shown · 2 selected');
  await search.fill('no-match');
  await expect(groups.getByText('No matching columns. Try another search.')).toBeVisible();
  await search.fill('');
  await groups.getByRole('button',{name:'Selected only (2)'}).click();
  await expect(groups.getByRole('status')).toHaveText('2 of 500 columns shown · 2 selected');
  await expect(subject).toHaveAttribute('aria-pressed','true');
  await groups.getByRole('button',{name:'Clear selection',exact:true}).click();
  await expect(groups.getByText('No columns selected.',{exact:false})).toBeVisible();
  await groups.getByRole('button',{name:'Selected only (0)'}).click();
  await expect(groups.getByRole('status')).toHaveText('500 of 500 columns shown · 0 selected');
  const features=page.getByRole('group',{name:'Feature columns for exact matching',exact:true});
  await features.getByRole('searchbox').fill('feature_497');
  await features.getByRole('button',{name:'feature_497',exact:true}).click();
  await expect(features.getByRole('status')).toHaveText('1 of 500 columns shown · 1 selected');
  await page.getByLabel('What would you like to do?').selectOption('drop');
  const cleaning=page.getByRole('group',{name:'Choose columns',exact:true});
  await cleaning.getByRole('searchbox').fill('subject');
  await cleaning.getByRole('button',{name:'Subject_ID',exact:true}).click();
  await cleaning.getByRole('searchbox').fill('城市');
  await cleaning.getByRole('button',{name:'城市',exact:true}).click();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await expect(page.getByRole('list',{name:'Ordered cleaning recipe'})).toContainText('Subject_ID, 城市');
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await page.getByText('See the resulting records and fitted values',{exact:true}).click();
  await expect(page.locator('.preview-records thead th')).toHaveCount(498);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

const sessions = new Map<Page, string[]>();
test.beforeEach(async ({page})=>{
  sessions.set(page,[]);
  page.on('response',async response=>{
    if(response.url().endsWith('/api/sessions') && response.request().method()==='POST' && response.ok()) {
      const session = await response.json();
      sessions.get(page)?.push(session.id);
    }
  });
});
test.afterEach(async ({page,request})=>{
  for(const id of sessions.get(page)||[]) await request.delete(`/api/sessions/${id}`);
  sessions.delete(page);
});

test('demo → audit → recipe → preview → downloadable export', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error=>errors.push(error.message));
  await openWorkbench(page);
  await expect(page.getByRole('heading',{name:/A little clarity/})).toBeVisible();
  await page.getByRole('button',{name:'Explore the demo'}).click();
  await expect(page.getByText('train.csv',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:/Identical features across splits/})).toBeVisible();
  await page.getByRole('button',{name:/Shared subjects: subject_id/}).click();
  await expect(page.getByText('S01',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Cleaning studio',exact:true}).click();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Export & reproduce',exact:true}).click();
  await page.getByRole('button',{name:'Prepare export'}).click();
  const link = page.getByRole('link',{name:'Download your bundle'});
  await expect(link).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await link.click();
  expect((await downloaded).suggestedFilename()).toBe('datasetmedic-export.zip');
  expect(errors).toEqual([]);
});

test('upload, conversion failures, stale previews, and clear',async({page})=>{
  await openWorkbench(page);
  await page.getByRole('button',{name:'Check a dataset'}).click();
  await page.locator('#file-import').setInputFiles({name:'messy.csv',mimeType:'text/csv',buffer:Buffer.from('value,city\n1,Pune\nbad,Delhi\n1,Pune\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:/Mixed numeric and text/})).toBeVisible();
  await page.getByLabel('What would you like to do?').selectOption('cast');
  await page.locator('.builder-body').getByRole('button',{name:'value',exact:true}).click();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Export & reproduce',exact:true}).click();
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/I reviewed 1 failed conversions/}).check();
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeEnabled();
  await page.getByRole('button',{name:'Remove recipe step 1'}).click();
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeDisabled();
  await page.getByRole('button',{name:'Clear session'}).click();
  await expect(page.getByText('messy.csv',{exact:true})).toHaveCount(0);
});

test('malformed import reports an error and the app remains usable',async({page})=>{
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'header-only.csv',mimeType:'text/csv',buffer:Buffer.from('x,y\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('at least one data row');
  await expect(page.getByRole('button',{name:'Run health check',exact:true})).toBeEnabled();
});

test('mobile layout and reduced-motion scroll reveal', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await openWorkbench(page);
  await page.getByRole('button',{name:'Check a dataset'}).click();
  await expect(page.getByRole('heading',{name:'Drop in a little possibility.'})).toBeVisible();
  const widths = await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.width);
  await page.locator('#export').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading',{name:/Good data./})).toBeVisible();
});

test('active analysis can be cancelled',async({page})=>{
  await openWorkbench(page);
  await page.getByRole('button',{name:'Explore the demo'}).click();
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Job cancelled'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Run health check',exact:true})).toBeEnabled();
});

test('empty and populated workbench pass automated WCAG A/AA checks',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await openWorkbench(page);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Explore the demo'}).click();
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await page.getByRole('button',{name:/Shared subjects: subject_id/}).click();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});

test('constant text fills preserve leading zeros',async({page})=>{
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'codes.csv',mimeType:'text/csv',buffer:Buffer.from('code,amount\nA1,2\n,3\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview changes'})).toBeEnabled();
  await page.getByLabel('What would you like to do?').selectOption('fill');
  await page.locator('.builder-body').getByRole('button',{name:'code',exact:true}).click();
  await page.getByLabel('Fill strategy').selectOption('constant');
  await page.getByLabel('Fill value',{exact:true}).fill('001');
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await page.getByText('See the resulting records and fitted values',{exact:true}).click();
  await expect(page.getByRole('cell',{name:'001',exact:true})).toBeVisible();
});

test('scroll reveals work for tall panels from wide datasets',async({page})=>{
  await openWorkbench(page);
  const csv=Array.from({length:500},(_,i)=>`column_${i}`).join(',')+'\n'+Array(500).fill('1').join(',')+'\n';
  await page.locator('#file-import').setInputFiles({name:'wide.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  const panel=page.locator('.profile-panel').first();
  await expect(panel).toBeAttached();
  await panel.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  await expect(panel.locator('..')).toHaveClass(/visible/);
  await expect(panel.getByText('column_0',{exact:true}).first()).toBeVisible();
});

test('recipe order changes results and invalidates the approved preview',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'order.csv',mimeType:'text/csv',buffer:Buffer.from('code,noise\nA,1\nA,2\nB,3\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add recipe step'})).toBeEnabled();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByLabel('What would you like to do?').selectOption('drop');
  await page.locator('.builder-body').getByRole('button',{name:'noise',exact:true}).click();
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await expect(page.getByRole('button',{name:'Move recipe step 1 up'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Move recipe step 2 down'})).toBeDisabled();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await expect(page.locator('.preview-panel tbody tr').nth(1).locator('td').nth(4)).toHaveText('3');
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeEnabled();
  const move=page.getByRole('button',{name:'Move recipe step 2 up'});
  await move.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Move recipe step 1 down'})).toBeFocused();
  await expect(page.getByRole('list',{name:'Ordered cleaning recipe'}).getByRole('listitem').first()).toContainText('Drop columns');
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeDisabled();
  await expect(page.getByText('Recipe or settings changed — preview again')).toBeVisible();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await expect(page.locator('.preview-panel tbody tr').nth(1).locator('td').nth(4)).toHaveText('2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('recipe editing supports save, cancel, keyboard focus and preview protection',async({page})=>{
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'edit.csv',mimeType:'text/csv',buffer:Buffer.from('code,amount\nA1,2\n,3\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add recipe step'})).toBeEnabled();
  await page.getByLabel('What would you like to do?').selectOption('fill');
  await page.locator('.builder-body').getByRole('button',{name:'code',exact:true}).click();
  await page.getByLabel('Fill strategy').selectOption('constant');
  await page.getByLabel('Fill value',{exact:true}).fill('001');
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit recipe step 1'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('What would you like to do?')).toBeFocused();
  await expect(page.getByLabel('Fill value',{exact:true})).toHaveValue('001');
  await expect(page.getByRole('button',{name:'Preview changes'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeDisabled();
  await page.getByLabel('Fill value',{exact:true}).fill('002');
  await page.getByRole('button',{name:'Cancel editing'}).click();
  await expect(page.getByRole('button',{name:'Edit recipe step 1'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeEnabled();
  await expect(page.getByRole('list',{name:'Ordered cleaning recipe'})).toContainText('constant: 001');
  await page.getByRole('button',{name:'Edit recipe step 1'}).click();
  await page.getByLabel('Fill value',{exact:true}).fill('002');
  await page.getByRole('button',{name:'Save step changes'}).click();
  await expect(page.getByRole('button',{name:'Edit recipe step 1'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Prepare export'})).toBeDisabled();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await page.getByText('See the resulting records and fitted values',{exact:true}).click();
  await expect(page.getByRole('cell',{name:'002',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Remove recipe step 1'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Add recipe step'})).toBeFocused();
  await expect(page.getByRole('list',{name:'Ordered cleaning recipe'})).toHaveCount(0);
});

test('keyboard navigation exposes current location and selected columns',async({page})=>{
  await openWorkbench(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to workbench'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('button',{name:'Explore the demo'}).click();
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'All findings',pressed:true})).toBeVisible();
  await page.getByRole('button',{name:'Split risks'}).click();
  await expect(page.getByRole('button',{name:'Split risks',pressed:true})).toBeVisible();
  const group=page.getByRole('group',{name:'Subject / group columns'}).getByRole('button',{name:'subject_id',exact:true});
  await expect(group).toHaveAttribute('aria-pressed','true');
  await group.focus();await page.keyboard.press('Space');
  await expect(group).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Cleaning studio',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cleaning studio',exact:true})).toHaveAttribute('aria-current','location');
  await page.getByLabel('What would you like to do?').selectOption('trim');
  const city=page.locator('.builder-body').getByRole('button',{name:'city',exact:true});
  await expect(city).toHaveAttribute('aria-pressed','false');
  await city.focus();await page.keyboard.press('Space');
  await expect(city).toHaveAttribute('aria-pressed','true');
});

test('boolean fills from text are applied to boolean columns',async({page})=>{
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'flags.csv',mimeType:'text/csv',buffer:Buffer.from('flag,name\ntrue,A\n,B\nfalse,C\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add recipe step'})).toBeEnabled();
  await page.getByLabel('What would you like to do?').selectOption('fill');
  await page.locator('.builder-body').getByRole('button',{name:'flag',exact:true}).click();
  await page.getByLabel('Fill strategy').selectOption('constant');
  await page.getByLabel('Fill value',{exact:true}).fill('false');
  await page.getByRole('button',{name:'Add recipe step'}).click();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByText('Up to date',{exact:true})).toBeVisible();
  await page.getByText('See the resulting records and fitted values',{exact:true}).click();
  const row=page.locator('.preview-records tbody tr').filter({has:page.getByRole('cell',{name:'B',exact:true})});
  await expect(row.getByRole('cell',{name:'false',exact:true})).toBeVisible();
});

test('large identifier evidence is shown without rounding',async({page})=>{
  await openWorkbench(page);
  await page.locator('#file-import').setInputFiles({name:'ids.csv',mimeType:'text/csv',buffer:Buffer.from('subject,value\n9007199254740992,1\n9007199254740993,2\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add recipe step'})).toBeEnabled();
  await page.getByText('Preview source records',{exact:true}).click();
  await expect(page.getByRole('cell',{name:'9007199254740992',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'9007199254740993',exact:true})).toBeVisible();
});
