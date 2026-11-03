import { changeCredentials } from '@/lib/account-store';
import { requireAccount,readAccountBody,authResponse,accountFailure } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:Request){try{const body=await readAccountBody(request),account=await requireAccount();const token=await changeCredentials(account.account_id,body.current_password,body.new_password);return authResponse({ok:true},200,token);}catch(e){return accountFailure(e);}}
