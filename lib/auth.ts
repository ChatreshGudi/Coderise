import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { accountForToken } from './account-store';
import { sessionConfiguration,SESSION_SECONDS } from './account-security';
import { sameOrigin } from './request-origin';
import { AccountError } from './list-rules';
export const getAccount=cache(async()=>accountForToken((await cookies()).get(sessionConfiguration().name)?.value));
export async function requireAccount(){const account=await getAccount();if(!account)throw new AccountError('Sign in to access your account and private lists.',401);return account;}
export async function rawSession(){return (await cookies()).get(sessionConfiguration().name)?.value;}
export function authResponse(data:unknown,status=200,token?:string|null){
 const response=NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
 if(token!==undefined){const config=sessionConfiguration();response.cookies.set(config.name,token??'',{httpOnly:true,secure:config.secure,sameSite:'lax',path:'/',maxAge:token?SESSION_SECONDS:0});}
 return response;
}
export async function readAccountBody(request:Request){
 if(!sameOrigin(request)||(process.env.CODERISE_ORIGIN&&request.headers.get('origin')!==sessionConfiguration().origin))throw new AccountError('Request origin was not accepted.',403);
 if(!(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'))throw new AccountError('Send JSON.',415);
 // Bound the stream even when Content-Length is absent or dishonest.
 const reader=request.body?.getReader();if(!reader)throw new AccountError('Send a JSON object.');
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){await reader.cancel();throw new AccountError('Request is too large.',413);}chunks.push(part.value);}}finally{reader.releaseLock();}
 let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccountError('Send a valid JSON object.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AccountError('Send a JSON object.');
 return body as Record<string,unknown>;
}
export function accountFailure(error:unknown){
 if(error instanceof AccountError)return authResponse({error:error.message},error.status);
 // Avoid logging request bodies, credentials, SQL parameter values or session tokens.
 console.error('Account operation failed.',{code:(error as {code?:string})?.code??'internal'});
 return authResponse({error:'This account operation is unavailable. Please try again.'},503);
}
