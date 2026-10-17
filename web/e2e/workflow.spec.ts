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
