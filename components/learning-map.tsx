'use client';
import Link from 'next/link';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,GitBranch,List} from 'lucide-react';
import type {LearningPlan} from '@/lib/learning-path';
import {practiceStatus} from '@/lib/learning-evidence';
import {withParams} from '@/lib/validation';
import {PreparationPractice,ExistingPractice,type PreparationView} from './preparation-practice';

export function LearningMap({plan,preparation}:{plan:LearningPlan;preparation?:PreparationView}){
 const [selected,setSelected]=useState(plan.review[0]||plan.target);
 const [view,setView]=useState<'graph'|'list'>('graph');
 const [hovered,setHovered]=useState<string|null>(null);
 const refs=useRef(new Map<string,HTMLButtonElement>());
 const marker=useId().replaceAll(':','');
 useEffect(()=>{if(window.matchMedia('(max-width:700px)').matches)setView('list')},[]);
 const byId=new Map(plan.topics.map(t=>[t.id,t])),topic=byId.get(selected)!;
 const levelWidth=226,nodeWidth=194,nodeHeight=94;
 const width=Math.max(560,(plan.levels.length-1)*levelWidth+nodeWidth+52),height=Math.max(250,Math.max(...plan.levels.map(l=>l.length))*124+56);
 const positions=new Map(plan.levels.flatMap((level,i)=>level.map((id,j)=>[id,{x:plan.levels.length===1?(width-nodeWidth)/2:26+i*levelWidth,y:(height-level.length*124)/2+j*124+15}] as const)));
 const parents=plan.edges.filter(e=>e.to===selected),children=plan.edges.filter(e=>e.from===selected);
 const emphasis=hovered||selected;
 const isGoal=(id:string)=>plan.targets.includes(id);
 function move(key:string,id:string){
  const level=plan.levels.findIndex(l=>l.includes(id)),row=plan.levels[level].indexOf(id);
  const dest=key==='ArrowLeft'?plan.levels[level-1]?.[Math.min(row,(plan.levels[level-1]?.length??1)-1)]:key==='ArrowRight'?plan.levels[level+1]?.[Math.min(row,(plan.levels[level+1]?.length??1)-1)]:key==='ArrowUp'?plan.levels[level][row-1]:key==='ArrowDown'?plan.levels[level][row+1]:null;
  if(dest){setSelected(dest);refs.current.get(dest)?.focus()}
 }
 return <section className="goal-map" aria-label="Your goal and practice connections">
  <div className="map-review"><div><span className="eyebrow muted">A place to explore next</span><div className="map-review-topics">{plan.review.map(id=><button key={id} onClick={()=>setSelected(id)}>{byId.get(id)?.name}<ArrowRight size={15}/></button>)}</div><p className="small muted">{plan.topics.length===1?'This goal has no additional background in the curated map. Inspect its practice evidence below.':isGoal(plan.review[0])?'Your background topics have accepted practice in the imported history. Explore the goal next.':'These are the first background topics without an accepted solve in your imported history. Check whether you need a refresher.'}</p></div><span className="mono map-review-note">Practice evidence, not a readiness score.</span></div>
  <div className="map-toolbar"><div><span className="eyebrow muted">01 / Your topic map</span><h2>See what connects.</h2></div><div className="map-view-controls" role="group" aria-label="Map display"><button aria-pressed={view==='graph'} onClick={()=>setView('graph')}><GitBranch size={14}/>Graph</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={14}/>List</button></div></div>
  <div className="map-legend mono"><span><i className="legend-practiced"/>Practiced</span><span><i className="legend-attempted"/>Attempted, no accepted solve</span><span><i/>No imported evidence</span><span className="map-legend-goal">RED BORDER / {preparation?'PROBLEM TOPIC':'GOAL'}</span></div>
  {view==='graph'?<><div className="map-viewport" role="group" aria-label="Interactive prerequisite graph"><div className="map-canvas" style={{width,height}}>
   <svg width={width} height={height} aria-hidden="true"><defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="currentColor"/></marker></defs>{plan.edges.map(e=>{const a=positions.get(e.from)!,b=positions.get(e.to)!;const active=e.from===emphasis||e.to===emphasis;const span=Math.round((b.x-a.x)/levelWidth),lane=14+Math.max(0,span-2)*18;const path=span>1?`M${a.x+nodeWidth},${a.y+nodeHeight/2} H${a.x+nodeWidth+12} V${lane} H${b.x-13} V${b.y+nodeHeight/2} H${b.x-5}`:`M${a.x+nodeWidth},${a.y+nodeHeight/2} C${a.x+nodeWidth+16},${a.y+nodeHeight/2} ${b.x-16},${b.y+nodeHeight/2} ${b.x-5},${b.y+nodeHeight/2}`;return <path key={e.from+e.to} className={`map-edge ${active?'highlight':''}`} d={path} markerEnd={`url(#${marker})`}/>})}</svg>
   {plan.levels.flat().map(id=>{const t=byId.get(id)!,pos=positions.get(id)!;return <button key={id} ref={el=>{if(el)refs.current.set(id,el);else refs.current.delete(id)}} className={`map-node ${selected===id?'selected':''} ${isGoal(id)?'goal-node':''} ${t.solved?'has-practice':t.attempts?'has-attempts':''}`} style={{left:pos.x,top:pos.y,width:nodeWidth,height:nodeHeight}} aria-pressed={selected===id} aria-label={`${t.name}${isGoal(id)?', your goal':''}. ${practiceStatus(t)}. ${t.solved} unique solves.`} aria-controls="learning-inspector" onClick={()=>setSelected(id)} onMouseEnter={()=>setHovered(id)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(id)} onBlur={()=>setHovered(null)} onKeyDown={e=>{if(e.key.startsWith('Arrow')){e.preventDefault();move(e.key,id)}}}><span className="map-node-kicker mono">{isGoal(id)?(preparation?'TARGET TOPIC':'YOUR GOAL'):t.solved?'PRACTICED':t.attempts?'ATTEMPTED':'NO IMPORTED EVIDENCE'}</span><strong>{t.name}</strong><span className="mono map-node-count">{t.solved} unique {t.solved===1?'solve':'solves'} <span aria-hidden="true">↗</span></span></button>})}
  </div></div><p className="map-help small muted">Arrows show recommended background → next topic. Select a topic to inspect it. Use arrow keys between nodes, or switch to List. Scroll sideways if needed.</p></>:<ol className="map-list">{plan.levels.map((level,i)=><li key={i}><span className="eyebrow muted">{String(i+1).padStart(2,'0')}</span><div>{level.map(id=>{const t=byId.get(id)!;return <button key={id} className={`${selected===id?'selected':''} ${isGoal(id)?'list-goal':''}`} aria-pressed={selected===id} aria-controls="learning-inspector" onClick={()=>setSelected(id)}><span><strong>{t.name}</strong>{isGoal(id)&&<span className="mono accent">{preparation?'TARGET TOPIC':'YOUR GOAL'}</span>}</span><span className="small muted">{practiceStatus(t)} · {t.solved} unique {t.solved===1?'solve':'solves'}</span><ArrowRight size={15}/></button>})}</div></li>)}</ol>}
  <span className="sr-only" role="status">Selected {topic.name}</span>
  <section id="learning-inspector" className="map-inspector" aria-label={`${topic.name}: practice and connections`}>
   <div className="map-topic-detail"><span className="eyebrow muted">02 / {isGoal(selected)?'Your goal':'Selected background'}</span><h2>{topic.name}</h2><p className="muted">{topic.summary}</p>{!preparation&&<div className="map-counts"><div><strong>{topic.solved}</strong><span className="eyebrow muted">Unique solves</span></div><div><strong>{topic.attempts}</strong><span className="eyebrow muted">Judged attempts</span></div></div>}
    <Link className={`button ${preparation?'secondary':'primary'}`} href={withParams('/problems',{handle:plan.handle,tag:topic.tag,status:'unsolved'})}>{preparation?'Browse all problems for this topic':'Explore unsolved problems'} <ArrowUpRight size={15}/></Link>
    <div className="map-explanations"><h3 className="eyebrow">Why it connects</h3>{parents.length?parents.map(e=><div key={e.from}><button onClick={()=>setSelected(e.from)}>{byId.get(e.from)?.name} → {topic.name}</button><p className="small muted">{e.reason}</p></div>):<p className="small muted">This is a foundation topic in the curated map.</p>}{children.length>0&&<p className="small muted">Builds toward: {children.map((e,i)=><span key={e.to}>{i>0?', ':''}<button onClick={()=>setSelected(e.to)}>{byId.get(e.to)?.name}</button></span>)}</p>}</div>
   </div>
   {preparation?<PreparationPractice preparation={preparation} topic={topic} handle={plan.handle}/>:<div className="map-solved-detail"><span className="eyebrow muted">03 / Put the idea into practice</span><h3>Try this topic.</h3><p className="muted">Explore unsolved problems for {topic.name.toLowerCase()}, or inspect the context from your past practice.</p><Link className="button secondary" href={withParams('/problems',{handle:plan.handle,tag:topic.tag,status:'unsolved'})}>Browse unsolved problems <ArrowUpRight size={15}/></Link><ExistingPractice topic={topic} handle={plan.handle}/></div>}
  </section>
 </section>;
}
