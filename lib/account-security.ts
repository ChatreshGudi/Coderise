import { createHash,randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { AccountError } from './list-rules';
export const SESSION_SECONDS=7*24*60*60;
export function usernameValue(value:unknown){
 if(typeof value!=='string'||!/^[a-z0-9_]{3,30}$/.test(value.trim().toLowerCase()))throw new AccountError('Use 3–30 letters, numbers or underscores for your username.');
 return value.trim().toLowerCase();
}
export function passwordValue(value:unknown){
 if(typeof value!=='string'||value.length<8||value.length>128)throw new AccountError('Use a password between 8 and 128 characters. A long passphrase works well.');
 return value;
}
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const sessionToken=()=>randomBytes(32).toString('hex');
export const hashPassword=(value:string)=>argon2.hash(passwordValue(value),{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1,hashLength:32});
let dummy:Promise<string>|undefined;
export async function verifyPassword(hash:string|null,password:unknown){
 if(typeof password!=='string'||password.length>128)return false;
 const encoded=hash??await(dummy??=hashPassword(randomBytes(32).toString('hex')));
 const valid=await argon2.verify(encoded,password);
 return hash!==null&&valid;
}
export function sessionConfiguration(){
 const configured=process.env.CODERISE_ORIGIN;
 if(!configured&&process.env.NODE_ENV==='production')throw new Error('Set CODERISE_ORIGIN to the application origin before starting accounts.');
 const url=new URL(configured||'http://127.0.0.1:3000');
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!['http:','https:'].includes(url.protocol))throw new Error('CODERISE_ORIGIN must contain only an HTTP(S) origin.');
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Accounts require HTTPS outside loopback development.');
 const secure=url.protocol==='https:';
 return {origin:url.origin,name:secure?'__Host-coderise_session':'coderise_session',secure};
}
