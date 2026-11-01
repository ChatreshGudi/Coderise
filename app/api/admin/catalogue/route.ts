import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sameOrigin } from "@/lib/request";
import { startSync } from "@/lib/sync";
export async function POST(request:Request){
  if(!sameOrigin(request)||!await isAdmin())return NextResponse.json({error:'Developer access required.'},{status:403});
  try{return NextResponse.json(await startSync(null,'catalogue'));}
  catch(e){const message=e instanceof Error?e.message:'';const expected=/one minute|queue is busy|Please retry/.test(message);return NextResponse.json({error:expected?message:'Could not start catalogue refresh.'},{status:expected?400:503});}
}
