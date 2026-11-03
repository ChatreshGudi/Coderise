import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccount } from '@/lib/auth';
import { ownLists } from '@/lib/lists';
import { getProfile } from '@/lib/data';
import { Header,Footer,Strip,Metric } from '@/components/workspace';
import { AccountSettings,LogoutButton } from '@/components/account-settings';
import { PasswordSettings,DeleteAccount } from '@/components/account-security-controls';
import { withParams } from '@/lib/validation';
export const dynamic='force-dynamic';
export const metadata={title:'Your profile'};
export default async function ProfilePage(){
 const account=await getAccount();if(!account)redirect('/login');
 const [lists,profile]=await Promise.all([ownLists(account.account_id),getProfile(account.preferred_cf_handle??'')]);
 return <><Header active="profile"/><Strip right={<span>{account.role==='admin'?'ADMINISTRATOR':'PERSONAL WORKSPACE'}</span>}>ACCOUNT / {account.username}</Strip><main id="main" className="page account-page"><div className="page-heading"><span className="eyebrow muted">Your practice, collected</span><h1>{account.display_name}.</h1><p className="page-description">A home for your lists and the public profile you practise with.</p><div className="inline-actions"><Link className="button primary" href="/lists">Your lists →</Link>{account.preferred_cf_handle&&<Link className="button secondary" href={withParams('/dashboard',{handle:account.preferred_cf_handle})}>Open practice ↗</Link>}{account.role==='admin'&&<Link className="button secondary" href="/admin/sync">Data console ↗</Link>}<LogoutButton/></div></div><div className="metrics-band"><Metric label="Private lists" value={lists.length}/><Metric label="Saved problems" value={lists.reduce((sum,list)=>sum+Number(list.item_count),0)} detail="Entries across lists; a problem can be in several lists"/><Metric label="Preferred handle" value={account.preferred_cf_handle??'Not set'} detail={profile?'Imported public profile':account.preferred_cf_handle?'Not imported yet':'Choose one below'}/><Metric label="Member since" value={new Date(account.created_at).toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'})}/></div><div className="account-grid"><section className="account-panel"><span className="eyebrow muted">PROFILE SETTINGS</span><h2>Keep your place.</h2><AccountSettings displayName={account.display_name} handle={account.preferred_cf_handle}/>{account.preferred_cf_handle&&!profile&&<p className="notice"><Link className="text-link" href="/?switch=1">Import this handle’s public history →</Link></p>}</section><section className="account-panel"><span className="eyebrow muted">ACCOUNT SECURITY</span><h2>Change your password.</h2><p className="small muted">Use at least 8 characters. Changing your password signs out every other session.</p><PasswordSettings/><div className="account-delete"><DeleteAccount/></div></section></div></main><Footer/></>;
}
