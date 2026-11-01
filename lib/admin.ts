import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export function validAdminToken(token:unknown):boolean {
  const expected=process.env.CODERISE_ADMIN_TOKEN;
  if(!expected||typeof token!=='string')return false;
  const a=Buffer.from(expected),b=Buffer.from(token);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export async function isAdmin(){return validAdminToken((await cookies()).get('coderise_admin')?.value);}
