import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import type {PracticeTopic} from '@/lib/learning-evidence';
import type {ProblemPreparation} from '@/lib/problem-preparation';
import {withParams,cfProblem} from '@/lib/validation';
import {StatementPreview} from './statement-preview';
export type PreparationView=Pick<ProblemPreparation,'problem'|'practice'|'band'>;

export function ExistingPractice({topic,handle}:{topic:PracticeTopic;handle:string}){
 return <details className="existing-practice"><summary>Your existing practice · {topic.solved} unique {topic.solved===1?'solve':'solves'}</summary>
 <p className="small muted">Accepted examples connected through Codeforces tags. These provide context, not a mastery assessment.</p>
 {topic.solvedProblems.length?<ul className="map-solved-list">{topic.solvedProblems.map(p=><li key={p.key}><div><span className="eyebrow muted">{p.key} · {p.rating??'UNRATED'}</span><Link href={withParams(`/problems/${p.contest_id}/${p.problem_index}`,{handle})}>{p.name}<ArrowUpRight size={14}/></Link><span className="mono small muted">Accepted {new Date(p.solved_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})}</span></div></li>)}</ul>:<p className="small muted">{topic.attempts?'Judged attempts are present, but no accepted solve appears in the imported history.':'No accepted examples appear in the imported history. You may still know this topic.'}</p>}
 </details>;
}
export function PreparationPractice({preparation,topic,handle}:{preparation:PreparationView;topic:PracticeTopic;handle:string}){
 const practice=preparation.practice.find(t=>t.tag===topic.tag);
 return <div className="map-solved-detail preparation-practice"><span className="eyebrow muted">03 / Practise, then retry</span><h3>Build confidence with {topic.name.toLowerCase()}.</h3>
 <p className="small muted">{preparation.band.relation==='lower-rated'?`Unsolved practice below the target’s ${preparation.problem.rating} rating, chosen near your practice level.`:preparation.band.relation==='same-minimum-rating'?'Unsolved practice at 800, the same minimum catalogue rating as the target.':'Rated, unsolved practice near your starting difficulty. The target itself is unrated.'}</p>
 {practice?.problems.length?<ul className="preparation-practice-list">{practice.problems.map((p,i)=><li key={p.problem_id}><div className="preparation-practice-heading"><span className="eyebrow muted">{String(i+1).padStart(2,'0')} / {p.contest_id}{p.problem_index} · {p.rating} RATING</span><a href={cfProblem(p.contest_id,p.problem_index)} target="_blank" rel="noreferrer" aria-label={`Solve ${p.name} on Codeforces`} className="icon-button"><ArrowUpRight size={15}/></a></div><Link className="preparation-practice-name" href={withParams(`/problems/${p.contest_id}/${p.problem_index}`,{handle})}>{p.name}</Link><StatementPreview text={p.statement??null}/></li>)}</ul>:<div className="map-no-evidence"><p>No unsolved, rated practice fits this topic and preparation range.</p><Link href={withParams('/problems',{handle,tag:topic.tag,status:'unsolved'})} className="small">Browse this topic with a wider range →</Link></div>}
 <ExistingPractice topic={topic} handle={handle}/>
 </div>;
}
