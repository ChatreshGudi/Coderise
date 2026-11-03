import { changeListItem } from '@/lib/lists';
import { requireAccount,readAccountBody,authResponse,accountFailure } from '@/lib/auth';
import { throttle } from '@/lib/account-store';
type Context={params:Promise<{id:string}>};
async function change(request:Request,context:Context,add:boolean){try{const body=await readAccountBody(request),account=await requireAccount(),{id}=await context.params;await throttle('lists:'+account.account_id,120,60);await changeListItem(account.account_id,id,body.problem_id,add);return authResponse({ok:true});}catch(e){return accountFailure(e);}}
export const POST=(request:Request,context:Context)=>change(request,context,true);
export const DELETE=(request:Request,context:Context)=>change(request,context,false);
