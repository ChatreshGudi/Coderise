import { revokeToken } from '@/lib/account-store';
import { readAccountBody,rawSession,authResponse,accountFailure } from '@/lib/auth';
export async function POST(request:Request){try{await readAccountBody(request);await revokeToken(await rawSession());const response=authResponse({ok:true},200,null);response.cookies.set('coderise_handle','',{path:'/',maxAge:0});response.cookies.set('coderise_admin','',{path:'/',maxAge:0});return response;}catch(e){return accountFailure(e);}}
