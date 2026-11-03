"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CatalogueRefresh(){
  const router=useRouter(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function start(){setBusy(true);setMessage('');try{const response=await fetch('/api/admin/catalogue',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not start refresh.');setMessage(`Catalogue refresh ${data.job?.status||'started'}. Refresh the job list to see progress.`);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
  return <div><div className="inline-actions"><button className="button primary" disabled={busy} onClick={start}>Refresh catalogue</button><button className="button secondary" onClick={()=>router.refresh()}>Refresh job list</button></div>{message&&<p className="small muted" role="status">{message}</p>}</div>;
}
