import {NextResponse} from 'next/server';
import {getProfile} from '@/lib/data';
import {selectedHandle} from '@/lib/request';
import {topicId} from '@/lib/learning-graph';
import {learningPath,LearningGraphUnavailable} from '@/lib/learning-path';
import {prepareProblem,PreparationInputError} from '@/lib/problem-preparation';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const params=Object.fromEntries(new URL(request.url).searchParams);
 const hasProblem=Object.hasOwn(params,'problem');
 let target:string;
 try{target=hasProblem?'':topicId(params.target||'dp')}catch{return NextResponse.json({error:'Choose a topic from the learning map.'},{status:400})}
 try{
  const profile=await getProfile(await selectedHandle(params));
  if(!profile)return NextResponse.json({error:'Import a Codeforces profile first.'},{status:404});
  return NextResponse.json(hasProblem?{kind:'problem',...await prepareProblem(profile,params.problem)}:await learningPath(profile.user_id,target));
 }catch(error){if(error instanceof PreparationInputError)return NextResponse.json({error:error.message},{status:error.status});return NextResponse.json({error:error instanceof LearningGraphUnavailable?'The learning map is temporarily unavailable.':'Practice history is temporarily unavailable.'},{status:503})}
}
