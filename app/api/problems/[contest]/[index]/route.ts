import { NextResponse } from "next/server";
import { getProfile,problemDetails } from "@/lib/data";
import { selectedHandle } from "@/lib/request";
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{contest:string;index:string}>}){
  const {contest,index}=await params;
  if(!/^\d{1,7}$/.test(contest)||!/^[A-Za-z0-9]{1,5}$/.test(index))return NextResponse.json({error:'Invalid problem ID.'},{status:400});
  try{
    const handle=await selectedHandle(Object.fromEntries(new URL(request.url).searchParams));
    const profile=await getProfile(handle),details=await problemDetails(Number(contest),index,profile?.user_id??null);
    return details?NextResponse.json(details):NextResponse.json({error:'Problem not in the catalogue.'},{status:404});
  }catch{return NextResponse.json({error:'Problem details are temporarily unavailable.'},{status:503});}
}
