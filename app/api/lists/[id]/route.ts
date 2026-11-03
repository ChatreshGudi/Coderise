import { listContent,editList,deleteList } from '@/lib/lists';
import { requireAccount,readAccountBody,authResponse,accountFailure } from '@/lib/auth';
import { integer } from '@/lib/validation';
import { throttle } from '@/lib/account-store';
type Context={params:Promise<{id:string}>};
export const dynamic='force-dynamic';
export async function GET(request:Request,context:Context){try{const account=await requireAccount(),{id}=await context.params,p=new URL(request.url).searchParams;return authResponse(await listContent(account.account_id,id,p.get('q')??'',p.get('status')??'',integer(p.get('page')??'',1,1,10000)));}catch(e){return accountFailure(e);}}
export async function PATCH(request:Request,context:Context){try{const body=await readAccountBody(request),account=await requireAccount(),{id}=await context.params;await throttle('lists:'+account.account_id,120,60);await editList(account.account_id,id,body);return authResponse({ok:true});}catch(e){return accountFailure(e);}}
export async function DELETE(request:Request,context:Context){try{await readAccountBody(request);const account=await requireAccount(),{id}=await context.params;await throttle('lists:'+account.account_id,120,60);await deleteList(account.account_id,id);return authResponse({ok:true});}catch(e){return accountFailure(e);}}
