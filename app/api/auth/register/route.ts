import { authenticate } from '@/lib/account-store';
import { readAccountBody,rawSession,authResponse,accountFailure } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:Request){try{const result=await authenticate(await readAccountBody(request),true,await rawSession());const response=authResponse({ok:true},201,result.token);response.cookies.set('coderise_handle','',{path:'/',maxAge:0});return response;}catch(e){return accountFailure(e);}}
