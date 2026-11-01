"use client";
import { FormEvent,useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight,RefreshCw } from "lucide-react";
type SyncState={job_id:string;status:string;stage:string;handle:string|null;error_message?:string};
function useImport(onComplete:(handle:string)=>void) {
  const [job,setJob]=useState<SyncState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!job||!['queued','running'].includes(job.status)) return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>;let failures=0;
    const poll=async()=>{
      try {
        const response=await fetch(`/api/sync/${job.job_id}`,{cache:'no-store'});const data=await response.json();
        if(!response.ok) throw new Error(data.error||'Could not check import status.');
        if(cancelled)return;
        failures=0;setJob(data);
        if(data.status==='completed'){setBusy(false);onComplete(data.handle||'');return;}
        if(data.status==='failed'){setBusy(false);setError(data.error_message||'Import failed. Please retry.');return;}
        timer=setTimeout(poll,1800);
      }catch{if(cancelled)return;failures++;if(failures>=5){setError('Connection interrupted. Refresh this page to check the import.');setBusy(false);}else timer=setTimeout(poll,3000);}
    };
    timer=setTimeout(poll,1000);return()=>{cancelled=true;clearTimeout(timer);};
    // Poll one durable job. The completion callback only navigates or refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[job?.job_id]);
  async function start(handle:string,refresh:boolean){
    setBusy(true);setError('');setJob(null);
    try {
      const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle,refresh})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not start import.');
      if(data.ready){setBusy(false);onComplete(data.handle);}else setJob(data.job);
    }catch(e){setBusy(false);setError(e instanceof Error?e.message:'Import failed.');}
  }
  return{job,busy,error,start};
}
export function HandleForm(){
  const router=useRouter(),[handle,setHandle]=useState('');
  const state=useImport(name=>router.push(`/dashboard?handle=${encodeURIComponent(name)}`));
  function submit(event:FormEvent){event.preventDefault();void state.start(handle,false);}
  return <form onSubmit={submit} className="handle-form">
    <label htmlFor="handle" className="eyebrow">Your Codeforces handle</label>
    <div className="handle-input"><span aria-hidden="true">@</span><input id="handle" name="handle" value={handle} onChange={e=>setHandle(e.target.value)} placeholder="e.g. Chatresh" required maxLength={40} autoComplete="off" spellCheck={false} disabled={state.busy}/><button className="button primary" disabled={state.busy||!handle.trim()}>{state.busy?'Importing':'View practice'}<ArrowRight size={17}/></button></div>
    <p className="muted form-note">Public Codeforces history. No registration or password.</p>
    {state.busy&&<div className="notice" role="status"><RefreshCw size={15} className="spin"/><span>{state.job?.stage||'Looking up your handle…'}<small>Keep this page open. Existing data stays available while a refresh runs.</small></span></div>}
    {state.error&&<p className="error-message" role="alert">{state.error}</p>}
  </form>;
}
export function RefreshProfile({handle,lastSynced}:{handle:string;lastSynced:string|null}){
  const router=useRouter();const state=useImport(()=>router.refresh());
  const lastRequest=useRef(0);
  const [label,setLabel]=useState(lastSynced?`Synced ${new Date(lastSynced).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'})}`:'Refresh history');
  useEffect(()=>{
    function update(){
      if(!lastSynced){setLabel('Refresh history');return;}
      const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(lastSynced))/60000));
      setLabel(minutes<1?'Synced just now':minutes<60?`Synced ${minutes}m ago`:minutes<1440?`Synced ${Math.floor(minutes/60)}h ago`:`Synced ${new Date(lastSynced).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'})}`);
    }
    update();const timer=setInterval(update,30000);return()=>clearInterval(timer);
  },[lastSynced]);
  useEffect(()=>{
    function refreshIfStale(){
      const now=Date.now();
      if(document.visibilityState==='visible'&&!state.busy&&now-lastRequest.current>60000&&(!lastSynced||now-Date.parse(lastSynced)>120000)){
        lastRequest.current=now;void state.start(handle,true);
      }
    }
    const initial=setTimeout(refreshIfStale,5000),timer=setInterval(refreshIfStale,60000);
    return()=>{clearTimeout(initial);clearInterval(timer);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[handle,lastSynced,state.busy]);
  return <div className="sync-control"><button type="button" className="sync-button" disabled={state.busy} onClick={()=>{lastRequest.current=Date.now();void state.start(handle,true);}} aria-label="Refresh Codeforces history" title="Active profiles refresh when history is over two minutes old"><span className={`status-dot ${state.busy?'pending':''}`}/><span>{state.busy?state.job?.stage||'Starting refresh…':label}</span><RefreshCw size={12} className={state.busy?'spin':''}/></button>{state.error&&<span className="sync-error" role="alert">{state.error}</span>}</div>;
}
export function RevealTags({tags}:{tags:string[]}){
  const[visible,setVisible]=useState(false);
  return <div className="reveal"><button className="text-button mono" onClick={()=>setVisible(!visible)} aria-expanded={visible}>{visible?'Hide topics':'Reveal topics'} {visible?'−':'+'}</button>{visible&&<div className="tags">{tags.map(tag=><span key={tag} className="tag">{tag}</span>)}</div>}</div>;
}
