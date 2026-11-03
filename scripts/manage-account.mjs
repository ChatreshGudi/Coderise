// Local privileged operator only. Never pass passwords in command arguments.
import { createRequire } from 'node:module';
import { createInterface,emitKeypressEvents } from 'node:readline';
import { stdin,stdout } from 'node:process';
import * as argon2 from 'argon2';
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd());
const {Client}=require('pg');
const [command,rawUsername]=process.argv.slice(2),username=rawUsername?.trim().toLowerCase();
if(!['create-admin','reset-password'].includes(command)||!username||!/^[a-z0-9_]{3,30}$/.test(username)){
 console.error('Usage: node scripts/manage-account.mjs create-admin|reset-password USERNAME');process.exit(1);
}
if(!stdin.isTTY){console.error('Use an interactive terminal to enter the password securely.');process.exit(1);}
async function secret(prompt){
 stdout.write(prompt);emitKeypressEvents(stdin);stdin.setRawMode(true);stdin.resume();
 return new Promise((resolve,reject)=>{let value='';function key(text,key={}){
  if(key.ctrl&&key.name==='c'){finish();reject(new Error('Cancelled.'));return;}
  if(key.name==='return'){finish();resolve(value);return;}
  if(key.name==='backspace'){value=Array.from(value).slice(0,-1).join('');return;}
  if(text&&!key.ctrl&&!key.meta&&!/[\x00-\x1f\x7f]/.test(text))value+=text;
 }function finish(){stdin.off('keypress',key);stdin.setRawMode(false);stdin.pause();stdout.write('\n');}stdin.on('keypress',key);});
}
const client=new Client({host:process.env.PGHOST||'localhost',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'coderise',user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD});
try{
 const password=await secret('New password (hidden; 8–128 characters): '),confirmation=await secret('Confirm password: ');
 if(password.length<8||password.length>128||password!==confirmation)throw new Error('Passwords must match and contain 8–128 characters.');
 const encoded=await argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1,hashLength:32});
 await client.connect();await client.query('BEGIN');
 if(command==='create-admin')await client.query("INSERT INTO site_account(username,display_name,password_hash,role) VALUES($1,$1,$2,'admin')",[username,encoded]);
 else{
  const result=await client.query('UPDATE site_account SET password_hash=$2,updated_at=now() WHERE username=$1 RETURNING account_id',[username,encoded]);
  if(!result.rowCount)throw new Error('Account not found.');
  await client.query('DELETE FROM auth_session WHERE account_id=$1',[result.rows[0].account_id]);
 }
 await client.query('COMMIT');console.log(command==='create-admin'?'Administrator created. Sign in through /login.':'Password reset. All previous sessions were revoked.');
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(error.code==='23505'?'Username already exists; create-admin will not overwrite it.':error.code?'Account operation failed.':error.message);process.exitCode=1;}
finally{await client.end().catch(()=>{});}
