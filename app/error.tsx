"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <main id="main" className="page error-page"><span className="eyebrow accent">Workspace unavailable</span><h1>Something interrupted<br/>your practice.</h1><p className="muted">Try again in a moment. If this is a fresh setup, check that PostgreSQL is running and migration 005 has been applied.</p><div className="inline-actions"><button className="button primary" onClick={reset}>Try again</button><Link href="/?switch=1" className="button secondary">Change handle</Link></div></main>;
}
