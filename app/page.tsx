import Link from "next/link";
import { redirect } from "next/navigation";
import { Header,Footer,Strip } from "@/components/workspace";
import { HandleForm } from "@/components/sync-controls";
import { selectedHandle } from "@/lib/request";
import { value,type Params } from "@/lib/validation";
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,handle=await selectedHandle();
  if(handle&&!value(params,'switch'))redirect(`/dashboard?handle=${encodeURIComponent(handle)}`);
  return <><Header/><Strip right={<span>01 — GET STARTED</span>}>CODEFORCES / A BETTER NEXT PROBLEM</Strip><main id="main" className="page entry-page"><div className="entry-kicker eyebrow"><span className="red-square"/> Find your next challenge</div><h1 className="entry-title">Practice with<br/>a little more<br/><span className="outlined-word">direction.</span></h1><div className="entry-bottom"><p className="entry-intro">Your submissions tell a story.<br/>Bring your Codeforces handle.<br/>Find a useful place to go next.</p><div className="entry-form-wrap"><HandleForm/><Link className="text-link" href="/problems">Just exploring? Browse the problem catalogue ↗</Link></div></div><div className="entry-footnote mono"><span>01 / IMPORT PUBLIC HISTORY</span><span>02 / UNDERSTAND YOUR PRACTICE</span><span>03 / SOLVE ON CODEFORCES ↗</span></div></main><Footer/></>;
}
