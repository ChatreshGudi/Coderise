import { requireAccount,authResponse,accountFailure } from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(){try{return authResponse({account:await requireAccount()});}catch(e){return accountFailure(e);}}
