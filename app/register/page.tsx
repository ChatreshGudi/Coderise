import { redirect } from 'next/navigation';
import { getAccount } from '@/lib/auth';
import { Header,Footer,Strip } from '@/components/workspace';
import { AuthForm } from '@/components/auth-form';
export const dynamic='force-dynamic';
export const metadata={title:'Create account'};
export default async function RegisterPage(){if(await getAccount())redirect('/profile');return <><Header/><Strip>YOUR WORKSPACE / CREATE ACCOUNT</Strip><main id="main" className="page auth-page"><div className="page-heading"><span className="eyebrow muted">A place for your next steps</span><h1>Make it yours.</h1><p className="page-description">Save practice lists across devices. Public Codeforces browsing stays open.</p></div><AuthForm register/></main><Footer/></>;}
