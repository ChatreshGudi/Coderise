import 'server-only';
import {query} from './db';
import type {Profile} from './data';
import {learningTopics} from './learning-graph';
import {learningPath,type LearningPlan} from './learning-path';
import {preparationProblemKey,preparationBand,distributePractice,type PreparationProblem,type PracticeProblem,type TopicPractice} from './preparation-rules';

export type ProblemPreparation={problem:PreparationProblem;plan:LearningPlan|null;practice:TopicPractice[];unmappedTags:string[];band:ReturnType<typeof preparationBand>};
export class PreparationInputError extends Error{constructor(message:string,public status=400){super(message)}}
export async function prepareProblem(profile:Pick<Profile,'user_id'|'rating'>,input:string):Promise<ProblemPreparation>{
 const key=preparationProblemKey(input);
 if(!key)throw new PreparationInputError('Enter a Codeforces problem ID (such as 1879C) or a Codeforces problem link.');
 const problem=(await query<PreparationProblem>(`SELECT p.problem_id,p.contest_id,p.problem_index,p.name,p.rating,
  ARRAY(SELECT t.name FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id ORDER BY t.name) AS tags,
  EXISTS(SELECT 1 FROM submission s WHERE s.problem_id=p.problem_id AND s.user_id=$3 AND s.verdict='OK') AS already_solved
  FROM problem p WHERE p.contest_id=$1 AND p.problem_index=$2`,[key.contest,key.index,profile.user_id]))[0];
 if(!problem)throw new PreparationInputError('That problem is not in Coderise’s catalogue yet. Check the ID or try another problem.',404);
 const mapped=learningTopics.filter(t=>problem.tags.includes(t.tag));
 const plan=mapped.length?await learningPath(profile.user_id,mapped.map(t=>t.id)):null;
 const unmappedTags=problem.tags.filter(tag=>!mapped.some(t=>t.tag===tag));
 const [history]=await query<{highest:number|null}>('SELECT max(p.rating) AS highest FROM submission s JOIN problem p USING(problem_id) WHERE s.user_id=$1 AND s.verdict=\'OK\'',[profile.user_id]);
 const effective=profile.rating??(history.highest===null?1000:history.highest+100);
 const band=preparationBand(effective,problem.rating);
 const topics=plan?plan.levels.flat().map(id=>plan.topics.find(t=>t.id===id)!):[];
 const ordered=[...(plan?.review??[]).map(id=>topics.find(t=>t.id===id)!),...topics];
 const wanted=[...new Map([...ordered.map(t=>({tag:t.tag,name:t.name})),...unmappedTags.filter(tag=>!tag.startsWith('*')).map(tag=>({tag,name:tag}))].map(t=>[t.tag,t])).values()];
 let candidates:(PracticeProblem&{tag:string})[]=[];
 if(wanted.length)candidates=await query<PracticeProblem&{tag:string}>(`WITH eligible AS (
  SELECT p.problem_id,p.contest_id,p.problem_index,p.name,p.rating,p.solved_count,t.name AS tag,
   row_number() OVER(PARTITION BY t.name ORDER BY abs(p.rating-$4),
    (SELECT count(*) FROM problem_tag pt2 WHERE pt2.problem_id=p.problem_id),p.solved_count DESC,p.problem_id) AS position
  FROM problem p JOIN problem_tag pt USING(problem_id) JOIN tag t USING(tag_id)
  WHERE t.name=ANY($1::text[]) AND p.rating BETWEEN $2 AND $3 AND p.problem_id<>$5
   AND NOT EXISTS(SELECT 1 FROM submission s WHERE s.user_id=$6 AND s.problem_id=p.problem_id AND s.verdict='OK')
 ) SELECT e.problem_id,e.contest_id,e.problem_index,e.name,e.rating,e.solved_count,e.tag,ps.description AS statement FROM eligible e
 LEFT JOIN problem_statement ps ON ps.problem_id=e.problem_id
 WHERE e.position<=30 ORDER BY e.position,e.tag`,[wanted.map(t=>t.tag),band.min,band.max,band.center,problem.problem_id,profile.user_id]);
 candidates=candidates.map(p=>{const name=wanted.find(t=>t.tag===p.tag)!.name.toLowerCase();return {...p,statement:p.statement?.trim().split(/\n\s*\n/).slice(0,2).join('\n\n').slice(0,4000)??null,reason:band.relation==='same-minimum-rating'?`Practice ${name} at the catalogue’s minimum rating; the target is also rated 800.`:band.relation==='unrated-target'?`Practice ${name} near your starting difficulty; the target has no published rating.`:`Practice ${name} at a lower rating before returning to ${problem.contest_id}${problem.problem_index}.`}});
 return {problem,plan,practice:distributePractice(wanted,candidates),unmappedTags,band};
}
