import {problemKey} from './validation';

export function preparationProblemKey(input:string){
 if(input.length>400)return null;
 const direct=problemKey(input);if(direct&&direct.contest>0)return direct;
 try{
  const url=new URL(input.trim());
  if(!['http:','https:'].includes(url.protocol)||!['codeforces.com','www.codeforces.com'].includes(url.hostname)||url.username||url.password||url.port)return null;
  const path=decodeURIComponent(url.pathname).replace(/\/$/,'');
  const match=path.match(/^\/problemset\/problem\/(\d{1,7})\/([A-Za-z]\d?)$/)||path.match(/^\/(?:contest|gym)\/(\d{1,7})\/problem\/([A-Za-z]\d?)$/);
  const parsed=match?problemKey(`${match[1]}/${match[2]}`):null;
  return parsed&&parsed.contest>0?parsed:null;
 }catch{return null}
}
export function preparationBand(effectiveRating:number,targetRating:number|null){
 const ceiling=targetRating===null?3500:Math.max(800,targetRating-100);
 const center=Math.max(800,Math.min(3500,effectiveRating-100,targetRating===null?3500:targetRating-200,ceiling));
 return {center,min:Math.max(800,center-200),max:Math.min(ceiling,center+200),
  relation:targetRating===null?'unrated-target' as const:targetRating===800?'same-minimum-rating' as const:'lower-rated' as const};
}
export type PracticeProblem={problem_id:number;contest_id:number;problem_index:string;name:string;rating:number;solved_count:number;reason:string;statement?:string|null};
export type TopicPractice={tag:string;name:string;problems:PracticeProblem[]};
export type PreparationProblem={problem_id:number;contest_id:number;problem_index:string;name:string;rating:number|null;tags:string[];already_solved:boolean};
// Distribute candidates across topics without repeating the same problem in the plan.
export function distributePractice(tags:{tag:string;name:string}[],candidates:(PracticeProblem&{tag:string})[]):TopicPractice[]{
 const used=new Set<number>(),result=tags.map(t=>({...t,problems:[] as PracticeProblem[]}));
 for(let round=0;round<3;round++)for(const topic of result){
  const next=candidates.find(p=>p.tag===topic.tag&&!used.has(p.problem_id));
  if(next){const {tag,...p}=next;topic.problems.push(p);used.add(p.problem_id)}
 }
 return result;
}
