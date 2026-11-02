import {learningTopics,type LearningTopic} from './learning-graph';

export type SolvedConnection={key:string;contest_id:number;problem_index:string;name:string;rating:number|null;solved_at:string};
export type PracticeTopic=LearningTopic&{solved:number;attempts:number;accepted:number;solvedProblems:SolvedConnection[]};
export type HistoryRow=SolvedConnection&{verdict:string;tags:string[]};
export type ProjectedSolve=SolvedConnection&{topics:string[]};
export function practiceSnapshot(rows:HistoryRow[]){
 const evidence=new Map(learningTopics.map(t=>[t.id,{solved:new Set<string>(),attempts:0,accepted:0}]));
 const solved=new Map<string,ProjectedSolve>();
 for(const row of rows){
  if(['TESTING','SUBMITTED','COMPILATION_ERROR'].includes(row.verdict))continue;
  const ids=learningTopics.filter(t=>row.tags.includes(t.tag)).map(t=>t.id);
  for(const id of ids){const e=evidence.get(id)!;e.attempts++;if(row.verdict==='OK'){e.accepted++;e.solved.add(row.key)}}
  if(row.verdict==='OK'&&ids.length){
   const prior=solved.get(row.key);
   if(!prior||row.solved_at>prior.solved_at){const {key,contest_id,problem_index,name,rating,solved_at}=row;solved.set(key,{key,contest_id,problem_index,name,rating,solved_at,topics:ids})}
  }
 }
 return {evidence,solves:[...solved.values()].sort((a,b)=>a.key.localeCompare(b.key))};
}
export function practiceStatus(t:{solved:number;attempts:number}){return t.solved?'Practiced':t.attempts?'Attempted · no accepted solve':'No imported evidence'}
// Keep uncovered background before its descendants; failure counts are not mastery labels.
export function suggestedReview(topics:PracticeTopic[],levels:string[][],target:string|string[]):string[]{
 const goals=Array.isArray(target)?target:[target];
 const byId=new Map(topics.map(t=>[t.id,t]));
 for(const level of levels){
  const missing=level.map(id=>byId.get(id)!).filter(t=>!goals.includes(t.id)&&t.solved===0);
  if(missing.length)return missing.sort((a,b)=>Number(b.attempts>0)-Number(a.attempts>0)||a.name.localeCompare(b.name)).map(t=>t.id);
 }
 return goals;
}
