import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccount } from '@/lib/auth';
import { ownLists } from '@/lib/lists';
import { Header,Footer,Strip,Empty } from '@/components/workspace';
import { ListEditor } from '@/components/list-controls';
export const dynamic='force-dynamic';
export const metadata={title:'Your lists'};
export default async function ListsPage(){
 const account=await getAccount();if(!account)redirect('/login');
 const lists=await ownLists(account.account_id);
 return <><Header active="lists"/><Strip right={<span>PRIVATE / {account.username}</span>}>YOUR WORKSPACE / LISTS</Strip><main id="main" className="page account-page"><div className="page-heading"><span className="eyebrow muted">A little intention, saved</span><h1>Your practice lists.</h1><p className="page-description">Collect problems for later. Keep each practice session focused.</p></div><div className="account-grid"><section><h2 className="account-section-title">{lists.length} {lists.length===1?'list':'lists'}</h2>{lists.length?<div className="problem-list-grid">{lists.map(list=><Link className="problem-list-card" href={`/lists/${list.list_id}`} key={list.list_id}><span className="eyebrow muted">PRIVATE · {list.item_count} PROBLEMS</span><h2>{list.name} <span aria-hidden="true">↗</span></h2>{list.description&&<p>{list.description}</p>}<span className="small muted">{account.preferred_cf_handle?`${list.solved_count} solved in ${account.preferred_cf_handle}'s imported history`:'Set a preferred handle in your profile to see solved status.'}</span></Link>)}</div>:<Empty title="Start with one good list.">Save problems from the catalogue, a recommendation, or a problem page.</Empty>}</section><aside className="account-panel"><span className="eyebrow muted">Make space for practice</span><h2>Create a list.</h2><ListEditor/></aside></div></main><Footer/></>;
}
