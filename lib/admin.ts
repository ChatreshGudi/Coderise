import 'server-only';
import { getAccount } from './auth';
export async function isAdmin(){return (await getAccount())?.role==='admin';}
