import { NextResponse } from "next/server";
import { getProfile,recommendations } from "@/lib/data";
import { selectedHandle } from "@/lib/request";
import { modeValue,value } from "@/lib/validation";
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{const params=Object.fromEntries(new URL(request.url).searchParams);const profile=await getProfile(await selectedHandle(params));if(!profile)return NextResponse.json({error:'Import a Codeforces profile first.'},{status:404});const mode=modeValue(value(params,'mode'));return NextResponse.json({handle:profile.cf_handle,mode,strategy:'topic_difficulty_baseline',problems:await recommendations(profile,mode)});}
  catch{return NextResponse.json({error:'Practice suggestions are temporarily unavailable.'},{status:503});}
}
