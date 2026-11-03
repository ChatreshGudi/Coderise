import { redirect } from 'next/navigation';
import { getAccount } from '@/lib/auth';
import { Header,Footer,Strip } from '@/components/workspace';
import { AuthForm } from '@/components/auth-form';
export const dynamic='force-dynamic';
export const metadata={title:'Sign in'};
export default async function LoginPage(){if(await getAccount())redirect('/profile');return <><Header/><Strip>YOUR WORKSPACE / SIGN IN</Strip><main id="main" className="page auth-page"><div className="page-heading"><span className="eyebrow muted">Pick up where you left off</span><h1>Back to practice.</h1><p className="page-description">Sign in for your private lists and saved profile.</p></div><AuthForm/></main><Footer/></>;}
