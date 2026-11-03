import { ownLists,createList } from '@/lib/lists';
import { requireAccount,readAccountBody,authResponse,accountFailure } from '@/lib/auth';
import { throttle } from '@/lib/account-store';
export const dynamic='force-dynamic';
export async function GET(){try{const account=await requireAccount();return authResponse({lists:await ownLists(account.account_id)});}catch(e){return accountFailure(e);}}
export async function POST(request:Request){try{const body=await readAccountBody(request),account=await requireAccount();await throttle('lists:'+account.account_id,120,60);return authResponse({list:await createList(account.account_id,body)},201);}catch(e){return accountFailure(e);}}
