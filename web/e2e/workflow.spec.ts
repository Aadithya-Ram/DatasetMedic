import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

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
  await page.goto('/');
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
  await page.goto('/');
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
  await page.goto('/');
  await page.locator('#file-import').setInputFiles({name:'header-only.csv',mimeType:'text/csv',buffer:Buffer.from('x,y\n')});
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('at least one data row');
  await expect(page.getByRole('button',{name:'Run health check',exact:true})).toBeEnabled();
});

test('mobile layout and reduced-motion scroll reveal', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('button',{name:'Check a dataset'}).click();
  await expect(page.getByRole('heading',{name:'Drop in a little possibility.'})).toBeVisible();
  const widths = await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.width);
  await page.locator('#export').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading',{name:/Good data./})).toBeVisible();
});

test('active analysis can be cancelled',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the demo'}).click();
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Job cancelled'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Run health check',exact:true})).toBeEnabled();
});

test('empty and populated workbench pass automated WCAG A/AA checks',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Explore the demo'}).click();
  await page.getByRole('button',{name:'Run health check',exact:true}).click();
  await page.getByRole('button',{name:/Shared subjects: subject_id/}).click();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});

test('constant text fills preserve leading zeros',async({page})=>{
  await page.goto('/');
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
  await page.goto('/');
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
  await page.goto('/');
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
  await page.goto('/');
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
  await page.goto('/');
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
