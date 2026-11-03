import { cookies } from "next/headers";
import { value,validHandle,type Params } from "./validation";
import { getAccount } from "./auth";
export { sameOrigin } from "./request-origin";
export async function selectedHandle(params:Params={}):Promise<string> {
 const input=value(params,'handle')||(await cookies()).get('coderise_handle')?.value||(await getAccount())?.preferred_cf_handle||'';
 try{return validHandle(input);}catch{return '';}
}
