import { authenticate } from '@/lib/account-store';
import { readAccountBody,rawSession,authResponse,accountFailure } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:Request){try{const result=await authenticate(await readAccountBody(request),false,await rawSession());return authResponse({ok:true},200,result.token);}catch(e){return accountFailure(e);}}
