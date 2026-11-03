import 'server-only';
import { pool, query } from './db';
import { AccountError, listFields, positiveId } from './list-rules';

export type ProblemList = { list_id:number; name:string; description:string; created_at:Date|string; updated_at:Date|string; item_count:number; solved_count:number };
export type ListItem = { problem_id:number; contest_id:number; problem_index:string; name:string; rating:number|null; added_at:Date|string; solved:boolean };
export async function ownLists(accountId:number):Promise<ProblemList[]> {
  return query<ProblemList>(`SELECT l.*,count(i.problem_id)::int AS item_count,
    count(i.problem_id) FILTER (WHERE EXISTS (SELECT 1 FROM submission s JOIN app_user u USING(user_id)
      WHERE lower(u.cf_handle)=lower(a.preferred_cf_handle) AND s.problem_id=i.problem_id AND s.verdict='OK'))::int AS solved_count
    FROM problem_list l JOIN site_account a ON a.account_id=l.account_id
    LEFT JOIN problem_list_item i USING(list_id) WHERE l.account_id=$1
    GROUP BY l.list_id,a.preferred_cf_handle ORDER BY l.updated_at DESC,l.list_id DESC`,[accountId]);
}
export async function createList(accountId:number,body:Record<string,unknown>) {
  const {name,description}=listFields(body),client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT account_id FROM site_account WHERE account_id=$1 FOR UPDATE',[accountId]);
    const n=(await client.query('SELECT count(*)::int AS n FROM problem_list WHERE account_id=$1',[accountId])).rows[0].n;
    if(n>=100)throw new AccountError('You can keep up to 100 lists.');
    const row=(await client.query('INSERT INTO problem_list(account_id,name,description) VALUES($1,$2,$3) RETURNING *',[accountId,name,description])).rows[0];
    await client.query('COMMIT'); return row;
  } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
}
export async function editList(accountId:number,id:unknown,body:Record<string,unknown>) {
  const {name,description}=listFields(body);
  const row=(await query('UPDATE problem_list SET name=$3,description=$4,updated_at=now() WHERE list_id=$1 AND account_id=$2 RETURNING list_id',[positiveId(id),accountId,name,description]))[0];
  if(!row)throw new AccountError('List not found.',404);
}
export async function deleteList(accountId:number,id:unknown) {
  const row=(await query('DELETE FROM problem_list WHERE list_id=$1 AND account_id=$2 RETURNING list_id',[positiveId(id),accountId]))[0];
  if(!row)throw new AccountError('List not found.',404);
}
export async function changeListItem(accountId:number,id:unknown,problem:unknown,add:boolean) {
  const listId=positiveId(id),problemId=positiveId(problem),client=await pool.connect();
  try {
    await client.query('BEGIN');
    const own=(await client.query('SELECT list_id FROM problem_list WHERE list_id=$1 AND account_id=$2 FOR UPDATE',[listId,accountId])).rows[0];
    if(!own)throw new AccountError('List not found.',404);
    if(add){
      const exists=(await client.query('SELECT problem_id FROM problem WHERE problem_id=$1',[problemId])).rows[0];
      if(!exists)throw new AccountError('Problem not found.',404);
      const count=(await client.query('SELECT count(*)::int AS n FROM problem_list_item WHERE list_id=$1',[listId])).rows[0].n;
      const present=(await client.query('SELECT 1 FROM problem_list_item WHERE list_id=$1 AND problem_id=$2',[listId,problemId])).rows.length;
      if(count>=1000&&!present)throw new AccountError('A list can contain up to 1,000 problems.');
      await client.query('INSERT INTO problem_list_item(list_id,problem_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[listId,problemId]);
    }else await client.query('DELETE FROM problem_list_item WHERE list_id=$1 AND problem_id=$2',[listId,problemId]);
    await client.query('UPDATE problem_list SET updated_at=now() WHERE list_id=$1',[listId]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function listContent(accountId:number,id:unknown,search='',status='',page=1) {
  const listId=positiveId(id);
  const list=(await query<ProblemList>('SELECT * FROM problem_list WHERE list_id=$1 AND account_id=$2',[listId,accountId]))[0];
  if(!list)throw new AccountError('List not found.',404);
  const args:unknown[]=[listId,accountId,search.slice(0,200)];
  const solved=`EXISTS(SELECT 1 FROM submission s JOIN app_user u USING(user_id) JOIN site_account a ON a.account_id=$2
    WHERE lower(u.cf_handle)=lower(a.preferred_cf_handle) AND s.problem_id=p.problem_id AND s.verdict='OK')`;
  const where=`WHERE l.list_id=$1 AND l.account_id=$2 AND ($3='' OR p.name ILIKE '%'||$3||'%' OR (p.contest_id::text||p.problem_index) ILIKE '%'||$3||'%')
    ${status==='solved'?`AND ${solved}`:status==='unsolved'?`AND NOT ${solved}`:''}`;
  const count=(await query<{n:number}>(`SELECT count(*)::int AS n FROM problem_list l JOIN problem_list_item i USING(list_id) JOIN problem p USING(problem_id) ${where}`,args))[0].n;
  const pages=Math.max(1,Math.ceil(count/50)),current=Math.min(Math.max(1,page),pages);
  const rows=await query<ListItem>(`SELECT p.problem_id,p.contest_id,p.problem_index,p.name,p.rating,i.added_at,${solved} AS solved
    FROM problem_list l JOIN problem_list_item i USING(list_id) JOIN problem p USING(problem_id) ${where}
    ORDER BY i.added_at DESC,p.problem_id DESC LIMIT 50 OFFSET $4`,[...args,(current-1)*50]);
  return {list,rows,count,page:current,pages};
}
