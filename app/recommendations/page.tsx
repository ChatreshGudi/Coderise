import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile,recommendations } from "@/lib/data";
import { selectedHandle } from "@/lib/request";
import { modeValue,value,withParams,type Mode,type Params } from "@/lib/validation";
import { Header,Footer,Strip,Empty,RecommendationRow } from "@/components/workspace";
import { RecommendationTopics } from "@/components/recommendation-topics";
export const dynamic='force-dynamic';
export const metadata={title:'Recommendations'};
const modes:{id:Mode;name:string;description:string}[]=[{id:'warm_up',name:'Warm up',description:'Find your rhythm at a comfortable difficulty.'},{id:'stretch',name:'Stretch',description:'Take a manageable step beyond your current level.'},{id:'fix_weaknesses',name:'Fix weaknesses',description:'Return to topics that deserve another attempt.'}];
export default async function RecommendationsPage({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,handle=await selectedHandle(params);if(!handle)redirect('/?switch=1');
  const profile=await getProfile(handle);if(!profile)redirect('/?switch=1');
  const mode=modeValue(value(params,'mode')),picks=await recommendations(profile,mode,5);
  return <><Header profile={profile} active="recommendations"/><Strip right={<span>{picks.length} SUGGESTIONS · {profile.rating??'UNRATED'} CURRENT RATING</span>}>PRACTICE / {profile.cf_handle}</Strip><main id="main" className="page"><div className="page-heading"><span className="eyebrow muted">A useful next step</span><h1>Choose your challenge.</h1><p className="page-description">A little direction. The work is still yours.</p></div><div className="mode-selector" aria-label="Practice mode">{modes.map(m=><Link key={m.id} href={withParams('/recommendations',{handle,mode:m.id})} className={mode===m.id?'selected':''} aria-current={mode===m.id?'page':undefined}><span className="eyebrow">{m.id===mode?'■':'□'} {m.name}</span><span>{m.description}</span></Link>)}</div>
    <p className="baseline-note mono">{profile.judged_count<20?'LIMITED HISTORY / Weakness analysis needs more judged attempts. Suggestions currently use difficulty and popularity.':'INITIAL PRACTICE BASELINE / Difficulty, imported topic history and catalogue popularity. Semantic ranking is under evaluation.'}</p>
    <RecommendationTopics>{picks.length?picks.map((p,i)=><RecommendationRow key={p.problem_id} problem={p} index={i} handle={handle}/>):<Empty title="No suitable candidates in this range."><Link href={withParams('/problems',{handle})}>Explore the full catalogue ↗</Link></Empty>}</RecommendationTopics>
    <div className="end-note"><span className="eyebrow">Practice, then return.</span><p className="muted">Submit on Codeforces. Refresh your history here to see the result reflected in your next suggestions.</p></div>
  </main><Footer/></>;
}
