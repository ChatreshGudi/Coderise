import { NextResponse } from "next/server";
import { getProfile,recommendationBatch } from "@/lib/data";
import { selectedHandle } from "@/lib/request";
import { modeValue,value } from "@/lib/validation";
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{const params=Object.fromEntries(new URL(request.url).searchParams);const profile=await getProfile(await selectedHandle(params));if(!profile)return NextResponse.json({error:'Import a Codeforces profile first.'},{status:404});const mode=modeValue(value(params,'mode'));const batch=await recommendationBatch(profile,mode);return NextResponse.json({handle:profile.cf_handle,mode,...batch});}
  catch{return NextResponse.json({error:'Practice suggestions are temporarily unavailable.'},{status:503});}
}
