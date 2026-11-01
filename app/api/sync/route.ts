import { NextResponse } from "next/server";
import { startSync } from "@/lib/sync";
import { validHandle } from "@/lib/validation";
import { sameOrigin } from "@/lib/request";
export const runtime='nodejs';
export async function POST(request:Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Request origin was not accepted.'},{status:403});
  try {
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=='object')return NextResponse.json({error:'Send a Codeforces handle as JSON.'},{status:400});
    const handle=validHandle(body.handle);
    const result=await startSync(handle,'profile',body.refresh===true);
    const response=NextResponse.json(result);
    response.cookies.set('coderise_handle',result.handle||handle,{httpOnly:true,sameSite:'lax',path:'/',maxAge:60*60*24*90,secure:process.env.NODE_ENV==='production'});
    return response;
  } catch(error) {
    const message=error instanceof Error?error.message:'';
    if(/valid Codeforces|one minute|queue is busy|Please retry/.test(message)) return NextResponse.json({error:message},{status:400});
    console.error('Profile import request failed:',message);
    return NextResponse.json({error:'Could not start the import. Check the database setup and try again.'},{status:503});
  }
}
