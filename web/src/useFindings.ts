import {useEffect, useState} from 'react';

export type Finding = {id: string; kind: string; title: string; detail: string; datasets: string[]; count: number; examples: Record<string, unknown>[]; severity: string; columns: string[]};
type Page = {key: string; total: number; items: Finding[]; error?: string};

export function useFindings(base: string, auditId: string, offset: number, query: string, severity: string) {
  const [page, setPage] = useState<Page | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([base, auditId, offset, query, severity, attempt]);
  useEffect(()=>{
    if (!auditId) return;
    const controller = new AbortController();
    let active = true;
    const parameters = new URLSearchParams({offset:String(offset),limit:'20',query,severity});
    void (async()=>{
      try {
        const response = await fetch(`${base}/jobs/${auditId}/findings?${parameters}`, {signal:controller.signal,headers:{'X-DatasetMedic':'1'}});
        if (!response.ok) throw new Error('Could not load findings. Retry to load this page.');
        const data = await response.json() as {total: number; items: Finding[]};
        if (active) setPage({key,...data});
      } catch (error) {
        if (active) setPage({key,total:0,items:[],error:(error as Error).message});
      }
    })();
    return ()=>{active=false;controller.abort();};
  },[base,auditId,offset,query,severity,key]);
  const current = auditId && page?.key === key ? page : null;
  return {items:current?.items || [],total:current?.total || 0,error:current?.error,loading:!!auditId && !current,retry:()=>setAttempt(value=>value+1)};
}
