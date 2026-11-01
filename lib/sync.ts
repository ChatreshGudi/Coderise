import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { query } from "./db";
import { getProfile,type Job } from "./data";
export async function startSync(handle:string|null,kind:'profile'|'catalogue',refresh=true) {
  if(kind==='profile'&&!refresh) {
    const profile=await getProfile(handle!);
    if(profile) return {ready:true,handle:profile.cf_handle,job:null};
  }
  // Recover visibly abandoned jobs instead of leaving a permanent loading screen.
  await query("UPDATE sync_job SET status='failed',stage='Import interrupted',error_message='The import timed out. Please retry.',finished_at=now() WHERE status IN ('queued','running') AND created_at<now()-interval '15 minutes'");
  const active=await query<Job>("SELECT * FROM sync_job WHERE kind=$1 AND ($1='catalogue' OR lower(handle)=lower($2)) AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1",[kind,handle]);
  if(active[0]) return {ready:false,handle,job:active[0]};
  const latest=await query<Job>("SELECT * FROM sync_job WHERE kind=$1 AND ($1='catalogue' OR lower(handle)=lower($2)) ORDER BY created_at DESC LIMIT 1",[kind,handle]);
  if(latest[0]&&Date.now()-new Date(latest[0].created_at).getTime()<60000) throw new Error('Please wait one minute between refresh attempts.');
  const queued=await query<{count:number}>("SELECT count(*) FROM sync_job WHERE status IN ('queued','running')");
  if(queued[0].count>=4) throw new Error('The import queue is busy. Please try again shortly.');
  const job=(await query<Job>("INSERT INTO sync_job(kind,handle) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *",[kind,handle]))[0];
  if(!job) {
    const existing=(await query<Job>("SELECT * FROM sync_job WHERE kind=$1 AND ($1='catalogue' OR lower(handle)=lower($2)) AND status IN ('queued','running') LIMIT 1",[kind,handle]))[0];
    if(!existing) throw new Error('Could not start the import. Please retry.');
    return {ready:false,handle,job:existing};
  }
  const localPython=path.join(process.cwd(),'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const python=process.env.CODERISE_PYTHON || (existsSync(localPython)?localPython:(process.platform==='win32'?'py':'python3'));
  const child=spawn(python,[path.join(process.cwd(),'scripts/sync_web_job.py'),job.job_id],{
    cwd:process.cwd(),env:process.env,windowsHide:true,detached:true,stdio:'ignore',shell:false,
  });
  child.on('error',async()=>{await query("UPDATE sync_job SET status='failed',stage='Could not launch importer',error_message='Configure the Python virtual environment and retry.',finished_at=now() WHERE job_id=$1",[job.job_id]).catch(console.error);});
  child.unref();
  return {ready:false,handle,job};
}
