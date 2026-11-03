import 'server-only';
import type { PoolClient } from 'pg';
import { pool,query } from './db';
import { AccountError } from './list-rules';
import { digest,sessionToken,SESSION_SECONDS,hashPassword,verifyPassword,usernameValue,passwordValue } from './account-security';
import { validHandle } from './validation';
export type Account={account_id:number;username:string;display_name:string;role:'user'|'admin';preferred_cf_handle:string|null;created_at:Date|string};
const fields='account_id,username,display_name,role,preferred_cf_handle,created_at';
export async function accountForToken(token:string|undefined):Promise<Account|null>{
 if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
 return (await query<Account>(`SELECT ${fields.split(',').map(f=>'a.'+f).join(',')} FROM auth_session s JOIN site_account a USING(account_id) WHERE s.token_hash=$1 AND s.expires_at>now()`,[digest(token)]))[0]??null;
}
async function issueSession(client:PoolClient,accountId:number){
 const token=sessionToken();await client.query("INSERT INTO auth_session(token_hash,account_id,expires_at) VALUES($1,$2,now()+$3*interval '1 second')",[digest(token),accountId,SESSION_SECONDS]);return token;
}
export async function throttle(key:string,limit:number,seconds:number){
 const row=(await query<{attempts:number}>(`INSERT INTO auth_throttle(key_hash,attempts,expires_at) VALUES($1,1,now()+$2*interval '1 second')
 ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN auth_throttle.expires_at<=now() THEN 1 ELSE auth_throttle.attempts+1 END,
 expires_at=CASE WHEN auth_throttle.expires_at<=now() THEN excluded.expires_at ELSE auth_throttle.expires_at END RETURNING attempts`,[digest(key),seconds]))[0];
 if(row.attempts>limit)throw new AccountError('Too many attempts. Please try again later.',429);
}
export async function authenticate(body:Record<string,unknown>,register:boolean,oldToken?:string){
 await throttle('auth:global',120,900);
 const username=usernameValue(body.username);
 await throttle('auth:username:'+username,8,900);
 if(register)await throttle('register:global',20,3600);
 const password=register?passwordValue(body.password):body.password;
 if(typeof password!=='string'||password.length>128)throw new AccountError('Username or password was not accepted.',401);
 let preferredHandle:string|null=null;
 if(register&&body.preferred_cf_handle!=null&&body.preferred_cf_handle!==''){
  try{preferredHandle=validHandle(body.preferred_cf_handle);}catch{throw new AccountError('Enter a valid Codeforces handle or leave it empty.');}
 }
 // Hash before obtaining a database lock. Login verification happens under its account lock.
 const encoded=register?await hashPassword(password):null;
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  let account:Account;
  if(register){
   account=(await client.query<Account>(`INSERT INTO site_account(username,display_name,password_hash,preferred_cf_handle) VALUES($1,$1,$2,$3) RETURNING ${fields}`,[username,encoded,preferredHandle])).rows[0];
  }else{
   const row=(await client.query<Account&{password_hash:string}>('SELECT * FROM site_account WHERE username=$1 FOR UPDATE',[username])).rows[0];
   if(!await verifyPassword(row?.password_hash??null,password))throw new AccountError('Username or password was not accepted.',401);
   account=row;
  }
  if(oldToken&&/^[0-9a-f]{64}$/.test(oldToken))await client.query('DELETE FROM auth_session WHERE token_hash=$1',[digest(oldToken)]);
  await client.query('DELETE FROM auth_session WHERE expires_at<=now() AND account_id=$1',[account.account_id]);
  const token=await issueSession(client,account.account_id);
  await client.query('COMMIT');return {account,token};
 }catch(e){await client.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new AccountError('That username is unavailable.',409);throw e;}finally{client.release();}
}
export async function revokeToken(token:string|undefined){if(token&&/^[0-9a-f]{64}$/.test(token))await query('DELETE FROM auth_session WHERE token_hash=$1',[digest(token)]);}
export async function updateAccount(accountId:number,body:Record<string,unknown>){
 if(typeof body.display_name!=='string'||!body.display_name.trim()||body.display_name.trim().length>60)throw new AccountError('Use a display name between 1 and 60 characters.');
 let handle:string|null=null;
 if(body.preferred_cf_handle!==''&&body.preferred_cf_handle!==null){try{handle=validHandle(body.preferred_cf_handle);}catch{throw new AccountError('Enter a valid Codeforces handle or leave it empty.');}}
 await query('UPDATE site_account SET display_name=$2,preferred_cf_handle=$3,updated_at=now() WHERE account_id=$1',[accountId,body.display_name.trim(),handle]);
}
export async function changeCredentials(accountId:number,current:unknown,next:unknown,remove=false){
 await throttle('credentials:'+accountId,8,900);
 const encoded=remove?null:await hashPassword(passwordValue(next));
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const row=(await client.query('SELECT password_hash FROM site_account WHERE account_id=$1 FOR UPDATE',[accountId])).rows[0];
  if(!await verifyPassword(row?.password_hash??null,current))throw new AccountError('Your current password was not accepted.',401);
  if(remove){await client.query('DELETE FROM site_account WHERE account_id=$1',[accountId]);await client.query('COMMIT');return null;}
  await client.query('UPDATE site_account SET password_hash=$2,updated_at=now() WHERE account_id=$1',[accountId,encoded]);
  await client.query('DELETE FROM auth_session WHERE account_id=$1',[accountId]);
  const token=await issueSession(client,accountId);await client.query('COMMIT');return token;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
