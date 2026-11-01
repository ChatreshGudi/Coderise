import { cookies } from "next/headers";
import { value,validHandle,type Params } from "./validation";
export async function selectedHandle(params:Params={}):Promise<string> {
  const input=value(params,'handle')||(await cookies()).get('coderise_handle')?.value||'';
  try { return validHandle(input); } catch { return ''; }
}
export function sameOrigin(request:Request): boolean {
  const origin=request.headers.get('origin');
  if(!origin)return false;
  try {
    // Next can normalize its internal URL to localhost; Host retains the browser's origin.
    const parsed=new URL(origin);
    return ['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host');
  } catch { return false; }
}
