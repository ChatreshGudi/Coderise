"use client";
import { FormEvent,useState } from "react";
import { useRouter } from "next/navigation";
export function AdminAccess(){
  const router=useRouter(),[token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/admin/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!response.ok)throw new Error('Developer access was not accepted.');setToken('');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
  return <form onSubmit={submit} className="admin-access"><label className="eyebrow" htmlFor="admin-token">Developer access token</label><input type="password" id="admin-token" autoComplete="current-password" required value={token} onChange={e=>setToken(e.target.value)}/><button className="button primary" disabled={busy}>Open sync console</button>{error&&<p role="alert" className="error-message">{error}</p>}</form>;
}
export function CatalogueRefresh(){
  const router=useRouter(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function start(){setBusy(true);setMessage('');try{const response=await fetch('/api/admin/catalogue',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not start refresh.');setMessage(`Catalogue refresh ${data.job?.status||'started'}. Refresh the job list to see progress.`);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
  return <div><div className="inline-actions"><button className="button primary" disabled={busy} onClick={start}>Refresh catalogue</button><button className="button secondary" onClick={()=>router.refresh()}>Refresh job list</button></div>{message&&<p className="small muted" role="status">{message}</p>}</div>;
}
