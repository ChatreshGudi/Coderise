import { NextResponse } from "next/server";
import { getProfile,searchProblems } from "@/lib/data";
import { selectedHandle } from "@/lib/request";
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{const params: import("@/lib/validation").Params=Object.fromEntries(new URL(request.url).searchParams);params.tag=new URL(request.url).searchParams.getAll("tag");const handle=await selectedHandle(params),profile=await getProfile(handle);return NextResponse.json(await searchProblems(params,profile?.user_id??null));}
  catch{return NextResponse.json({error:'Problem search is temporarily unavailable.'},{status:503});}
}
