import Link from "next/link";
import { ArrowRight,ArrowUpRight } from "lucide-react";
import type { Pick,Profile,Submission } from "@/lib/data";
import { cfProblem,number,withParams } from "@/lib/validation";
import { RefreshProfile } from "./sync-controls";
import { StatementPreview } from "./statement-preview";
import { InteractiveRatingChart } from "./rating-chart";
export async function Header({profile,handle='',active=''}:{profile?:Profile|null;handle?:string;active?:string}){
  const selected=profile?.cf_handle||handle;
  return <header className="site-header"><Link href="/" className="brand"><span className="brand-square"/>CODERISE</Link><span className="brand-caption">THE PRACTICE WORKSPACE</span>
    <nav aria-label="Main navigation">{[['Dashboard','/dashboard'],['Recommendations','/recommendations'],['Problems','/problems'],['Learning path','/path']].map(([name,path])=><Link key={path} href={withParams(path,{handle:selected})} className={active===name.toLowerCase()?'active':''} aria-current={active===name.toLowerCase()?'page':undefined}>[{name}]</Link>)}</nav>
    <div className="header-profile">{selected&&<RefreshProfile handle={selected} lastSynced={profile?.last_synced_at?new Date(profile.last_synced_at).toISOString():null}/>}<Link href="/?switch=1" className="handle-switch" title="Switch Codeforces handle">{selected||'Enter handle'} <span aria-hidden="true">↗</span></Link>{profile&&<span className="rank-label">{profile.rating??'Unrated'}{profile.rank_title?` ${profile.rank_title}`:''}</span>}</div>
  </header>;
}
export function Footer(){return <footer className="site-footer"><span><b>CODERISE</b> / DELIBERATE PRACTICE</span><span>PUBLIC CODEFORCES DATA <span className="footer-divider">/</span> SOLVE ON CODEFORCES ↗</span></footer>;}
export function Strip({children,right}:{children:React.ReactNode;right?:React.ReactNode}){return <div className="context-strip"><span>{children}</span>{right&&<span>{right}</span>}</div>;}
export function SectionHeading({number:label,title,aside}:{number:string;title:string;aside?:React.ReactNode}){return <div className="section-heading"><div><span className="eyebrow muted">{label}</span><h2>{title}</h2></div>{aside&&<div className="section-aside">{aside}</div>}</div>;}
export function Empty({title,children}:{title:string;children:React.ReactNode}){return <div className="empty-state"><span className="eyebrow">Nothing to show yet</span><h3>{title}</h3><div className="muted">{children}</div></div>;}
export function ProblemActions({problem,handle='',compact=false}:{problem:{contest_id:number;problem_index:string};handle?:string;compact?:boolean}){
  return <div className={compact?'row-actions':'problem-actions'}><a className="button primary" href={cfProblem(problem.contest_id,problem.problem_index)} target="_blank" rel="noreferrer">{compact?'Solve':'Solve on Codeforces'}<ArrowUpRight size={15}/></a><Link className="button secondary" href={withParams(`/problems/${problem.contest_id}/${problem.problem_index}`,{handle})}>{compact?'Details':'Inspect problem'}<ArrowRight size={15}/></Link></div>;
}
export function RecommendationRow({problem,index,handle}:{problem:Pick;index:number;handle:string}){
  return <article className="recommendation-row"><div className="recommendation-number mono">{String(index+1).padStart(2,'0')}</div><div className="recommendation-content"><div className="eyebrow muted">{problem.contest_id}/{problem.problem_index}<span className="separator">/</span>{problem.rating} RATING{problem.previous_attempts>0&&<span className="attempt-flag">Previously attempted</span>}</div><h2><Link href={withParams(`/problems/${problem.contest_id}/${problem.problem_index}`,{handle})}>{problem.name}</Link></h2><StatementPreview text={problem.statement}/><div className="tags recommendation-topics">{problem.tags.map(tag=><span key={tag} className="tag">{tag}</span>)}</div></div><ProblemActions problem={problem} handle={handle}/></article>;
}
export function Verdict({value}:{value:string|null}){return <span className={`verdict ${value==='OK'?'accepted':value&&['WRONG_ANSWER','TIME_LIMIT_EXCEEDED','RUNTIME_ERROR','MEMORY_LIMIT_EXCEEDED'].includes(value)?'failed':''}`}>{value==='OK'?'OK / Accepted':value?value.replaceAll('_',' ').toLowerCase():'Unattempted'}</span>;}
export function SubmissionTable({rows}:{rows:Submission[]}){
  return <div className="table-scroll"><table className="data-table submission-table"><thead><tr><th>Submitted · UTC</th><th>Problem</th><th>Rating</th><th>Language</th><th className="align-right">Verdict</th></tr></thead><tbody>{rows.map(row=><tr key={row.submission_id}><td className="mono muted">{new Date(row.submitted_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})}</td><td><a href={`https://codeforces.com/contest/${row.contest_id}/submission/${row.submission_id}`} target="_blank" rel="noreferrer"><span className="mono muted">{row.contest_id}{row.problem_index}</span> {row.name} ↗</a></td><td className="mono">{row.rating??'—'}</td><td className="muted language">{row.language??'—'}</td><td className="align-right"><Verdict value={row.verdict}/></td></tr>)}</tbody></table></div>;
}
export function Metric({label,value,detail}:{label:string;value:string|number;detail?:React.ReactNode}){return <div className="metric"><span className="eyebrow muted">{label}</span><strong>{value}</strong>{detail&&<span className="metric-detail">{detail}</span>}</div>;}
export function RatingChart({rows}:{rows:{new_rating:number;name:string;start_time:Date|string|null}[]}){
  const data=rows.filter(row=>row.new_rating!=null);
  if(data.length<2)return <Empty title="Your rating story starts here.">Contest rating changes will appear after they are available in your imported history.</Empty>;
  return <InteractiveRatingChart rows={data.map(row=>({new_rating:row.new_rating,name:row.name,date:row.start_time?new Date(row.start_time).toISOString():null}))}/>;
}
