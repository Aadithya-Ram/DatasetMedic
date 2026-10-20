import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const python=process.env.DATASETMEDIC_PYTHON || fileURLToPath(new URL('../../.venv/Scripts/python',import.meta.url));
const report=execFileSync(python,['-c',`
import tempfile,zipfile,json
from pathlib import Path
import polars as pl
from datasetmedic.worker import run_job
with tempfile.TemporaryDirectory() as folder:
 root=Path(folder)
 train=pl.DataFrame({'subject':['S1','S2','S3','S3','S4'],'city':['Delhi','東京','Pune','Pune',None],'value':[1,2,3,3,None],'label':[0,0,0,0,1]})
 test=pl.DataFrame({'subject':['S1','S5','S6'],'city':['Delhi','Mumbai','Pune'],'value':[1,8,9],'label':[0,1,0]})
 datasets=[]
 for key,frame in [('train',train),('test',test)]:
  path=root/(key+'.parquet');frame.write_parquet(path)
  datasets.append({'id':key,'name':key+'.parquet','path':str(path)})
 run_job(str(root),{'datasets':datasets,'request':{'kind':'export','config':{'roles':{'train':'train','test':'test'},'target':'label','groups':['subject'],'features':['city','value']},'recipe':{'steps':[{'op':'deduplicate'}]},'output_format':'parquet'}})
 if (root/'error.json').exists(): raise RuntimeError((root/'error.json').read_text())
 with zipfile.ZipFile(root/'export.zip') as bundle: print(bundle.read('report.html').decode('utf-8'))
`],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
 await page.setContent(report);
 await page.screenshot({path:fileURLToPath(new URL('../../docs/images/export-report.png',import.meta.url))});
 console.log('Captured the actual report from a synthetic cleaned export bundle.');
} finally {await browser.close();}
