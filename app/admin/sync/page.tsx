import Link from 'next/link';
import { getAccount } from '@/lib/auth';
import { query } from "@/lib/db";
import type { Job } from "@/lib/data";
import { number } from "@/lib/validation";
import { Header,Footer,Strip,SectionHeading,Metric } from "@/components/workspace";
import { CatalogueRefresh } from "@/components/admin-controls";
export const dynamic='force-dynamic';
export const metadata={title:'Data refresh'};
export default async function AdminPage(){
  const account=await getAccount();
  if(account?.role!=='admin')return <><Header/><Strip>ADMIN / DATA REFRESH</Strip><main id="main" className="page"><div className="page-heading"><span className="eyebrow muted">Restricted catalogue operations</span><h1>Data refresh.</h1><p className="page-description">{account?'Your account does not have administrator access.':'Sign in with an administrator account to use the data console.'}</p></div><Link className="button secondary" href={account?'/profile':'/login'}>{account?'Back to profile':'Sign in'}</Link></main><Footer/></>;
  const [coverage,jobs]=await Promise.all([query<{catalogue_problems:number;with_statements:number;without_statements:number}>('SELECT * FROM statement_coverage'),query<Job>('SELECT * FROM sync_job ORDER BY created_at DESC LIMIT 30')]);
  const c=coverage[0];
  return <><Header/><Strip right={<span>LOCAL IMPORT WORKER</span>}>DEVELOPER / DATA REFRESH</Strip><main id="main" className="page"><div className="page-heading"><span className="eyebrow muted">Public data, maintained deliberately</span><h1>Keep the index current.</h1><p className="page-description">Refresh catalogue metadata and inspect import outcomes.</p><CatalogueRefresh/></div><div className="metrics-band"><Metric label="Catalogue problems" value={number(c.catalogue_problems)}/><Metric label="Statements imported" value={number(c.with_statements)}/><Metric label="Missing statements" value={number(c.without_statements)}/><Metric label="Statement coverage" value={`${(100*c.with_statements/Math.max(1,c.catalogue_problems)).toFixed(1)}%`}/></div><SectionHeading number="IMPORT HISTORY" title="The job log"/><div className="table-scroll"><table className="data-table"><thead><tr><th>Started / UTC</th><th>Import</th><th>Status</th><th>Stage / outcome</th></tr></thead><tbody>{jobs.map(job=><tr key={job.job_id}><td className="mono">{new Date(job.created_at).toISOString().slice(0,16).replace('T',' ')}</td><td>{job.kind}{job.handle?` / ${job.handle}`:''}</td><td className={job.status==='failed'?'failed':job.status==='completed'?'accepted':''}>{job.status}</td><td>{job.stage}{job.error_message&&<p className="small failed">{job.error_message}</p>}{Object.keys(job.counts).length>0&&<p className="small muted">{Object.entries(job.counts).map(([k,v])=>`${k.replaceAll('_',' ')}: ${number(v)}`).join(' · ')}</p>}</td></tr>)}</tbody></table>{!jobs.length&&<p className="notice">No web imports have run yet.</p>}</div><p className="section-note small muted">Catalogue refresh updates metadata. Statement imports and experimental embeddings remain explicit scripts; they are not silently regenerated.</p></main><Footer/></>;
}
