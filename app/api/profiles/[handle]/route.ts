import { NextResponse } from "next/server";
import { dashboard,getProfile } from "@/lib/data";
import { validHandle } from "@/lib/validation";
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;let parsed:string;
  try{parsed=validHandle(handle);}catch{return NextResponse.json({error:'Invalid handle.'},{status:400});}
  try{const profile=await getProfile(parsed);if(!profile)return NextResponse.json({error:'Profile has not been imported.'},{status:404});return NextResponse.json({profile,...await dashboard(profile)});}
  catch{return NextResponse.json({error:'Profile statistics are temporarily unavailable.'},{status:503});}
}
