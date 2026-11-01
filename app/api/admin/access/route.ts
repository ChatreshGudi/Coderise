import { NextResponse } from "next/server";
import { validAdminToken } from "@/lib/admin";
import { sameOrigin } from "@/lib/request";
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'Request origin was not accepted.'},{status:403});
  const {token}=await request.json().catch(()=>({token:null}));
  if(!validAdminToken(token))return NextResponse.json({error:'Developer access was not accepted.'},{status:401});
  const response=NextResponse.json({ok:true});
  response.cookies.set('coderise_admin',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:3600});
  return response;
}
