import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile,problemDetails } from "@/lib/data";
import { selectedHandle } from "@/lib/request";
import { cfProblem,number,withParams,value,type Params } from "@/lib/validation";
import { Header,Footer,Strip,Empty,SectionHeading,SubmissionTable,Verdict } from "@/components/workspace";
import { Statement } from "@/components/statement";
import { ArrowUpRight } from "lucide-react";
export const dynamic='force-dynamic';
export default async function ProblemPage({params,searchParams}:{params:Promise<{contest:string;index:string}>;searchParams:Promise<Params>}){
  const route=await params;
  if(!/^\d{1,7}$/.test(route.contest)||!/^[A-Za-z0-9]{1,5}$/.test(route.index))notFound();
  const search=await searchParams,handle=await selectedHandle(search),profile=await getProfile(handle);
  const from=value(search,'from');
  const back=from==='/problems'||from.startsWith('/problems?')?from:withParams('/problems',{handle});
  const details=await problemDetails(Number(route.contest),route.index,profile?.user_id??null);if(!details)notFound();
  const {problem:p,recent,similar}=details;
  return <><Header profile={profile} handle={handle} active="problems"/><Strip right={<Link href={back}>BACK TO INDEX ↗</Link>}>PROBLEM / {p.contest_id}{p.problem_index}</Strip><main id="main" className="page detail-page"><div className="detail-title"><span className="eyebrow muted">{p.contest_name}</span><h1>{p.name}</h1><div className="detail-meta mono"><span>{p.contest_id}/{p.problem_index}</span><span>{p.rating??'UNRATED'}{p.rating?' RATING':''}</span><span>{number(p.solved_count)} USERS SOLVED</span></div><a className="button primary mobile-solve" href={cfProblem(p.contest_id,p.problem_index)} target="_blank" rel="noreferrer">Solve on Codeforces <ArrowUpRight size={16}/></a></div><div className="detail-grid"><article className="problem-statement">
      {p.description?<><Statement text={p.description}/>{p.input_format&&<><h2>Input</h2><Statement text={p.input_format}/></>}{p.output_format&&<><h2>Output</h2><Statement text={p.output_format}/></>}{p.examples&&p.examples.length>0&&<><h2>Examples</h2>{p.examples.map((example,i)=><div className="example" key={i}><div><span className="eyebrow">Input</span><pre>{example.input}</pre></div><div><span className="eyebrow">Output</span><pre>{example.output}</pre></div></div>)}</>}{p.note&&<><h2>Note</h2><Statement text={p.note}/></>}<p className="small muted source-note">Imported from the <a href={p.source_url||undefined} target="_blank" rel="noreferrer">Open R1 Codeforces dataset</a>. The original Codeforces page is the authoritative version.</p></>:<Empty title="This statement hasn’t been imported."><p>You can still read and solve the problem on Codeforces.</p><a className="button primary" href={cfProblem(p.contest_id,p.problem_index)} target="_blank" rel="noreferrer">Read on Codeforces <ArrowUpRight size={15}/></a></Empty>}
    </article><aside className="detail-sidebar"><a className="button primary full-width" href={cfProblem(p.contest_id,p.problem_index)} target="_blank" rel="noreferrer">Solve on Codeforces<ArrowUpRight size={16}/></a><div className="sidebar-block"><span className="eyebrow muted">Your imported history</span>{profile?<><Verdict value={p.verdict}/><p>{number(p.attempts)} {p.attempts===1?'submission':'submissions'} to this problem.</p></>:<p><Link href="/?switch=1">Enter a handle</Link> to see your attempts.</p>}</div><div className="sidebar-block"><span className="eyebrow muted">Algorithm topics</span><div className="tags">{p.tags.map(t=><Link className="tag" key={t} href={withParams('/problems',{handle,tag:t})}>{t}</Link>)}</div></div><div className="sidebar-block"><span className="eyebrow muted">Related by topic</span><p className="small muted">Shared tags and nearby difficulty.</p>{similar.length?<div className="related-list">{similar.map(s=><Link key={s.problem_id} href={withParams(`/problems/${s.contest_id}/${s.problem_index}`,{handle})}><span className="mono muted">{s.contest_id}{s.problem_index} / {s.rating??'Unrated'}</span><strong>{s.name} ↗</strong>{s.verdict==='OK'&&<span className="accepted small">Previously solved</span>}</Link>)}</div>:<p className="muted small">No related topics available.</p>}</div></aside></div>
    {profile&&<section><SectionHeading number="YOUR ATTEMPTS" title="Submission history"/>{recent.length?<SubmissionTable rows={recent}/>:<Empty title="A fresh challenge.">No submissions to this problem appear in the imported history.</Empty>}</section>}
  </main><Footer/></>;
}
