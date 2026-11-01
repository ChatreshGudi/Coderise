import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Job } from "@/lib/data";
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)) return NextResponse.json({error:'Invalid job ID.'},{status:400});
  try {
    const job=(await query<Job>('SELECT * FROM sync_job WHERE job_id=$1',[id]))[0];
    if(!job) return NextResponse.json({error:'Import not found.'},{status:404});
    const message=/not found|not exist/i.test(job.error_message||'')?'That Codeforces handle could not be found. Check the spelling and retry.':'The import failed. Check the handle and try again, or inspect the local job log.';
    return NextResponse.json({...job,error_message:job.status==='failed'?message:null},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'Import status is temporarily unavailable.'},{status:503});}
}
