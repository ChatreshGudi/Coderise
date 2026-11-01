import "server-only";
import { query } from "./db";
import { integer, problemKey, topicValues, value, type Mode, type Params } from "./validation";

export type Profile = {
  user_id: number; cf_handle: string; rating: number | null; max_rating: number | null;
  rank_title: string | null; country: string | null; last_synced_at: Date | null;
  submission_count: number; solved_count: number; attempted_count: number; accepted_submissions: number;
  judged_count: number;
  history_start: Date | null; latest_submission: Date | null;
};
export type Problem = {
  problem_id: number; contest_id: number; problem_index: string; name: string; rating: number | null;
  solved_count: number; tags: string[]; verdict: string | null; attempts: number;
};
export type Pick = Problem & { score: number; reason: string; previous_attempts: number; statement: string | null };
export type Submission = { submission_id: number; contest_id: number; problem_index: string; name: string; rating: number | null; verdict: string; submitted_at: Date; language: string | null; time_ms: number | null };
export type Topic = { name: string; attempts: number; accepted: number; wrong_attempts: number; proficiency: number; unique_solved: number };
export type Job = { job_id: string; kind: string; handle: string | null; status: string; stage: string; created_at: Date; started_at: Date | null; finished_at: Date | null; counts: Record<string,number>; error_message: string | null };

export async function getProfile(handle: string): Promise<Profile | null> {
  if (!handle) return null;
  return (await query<Profile>("SELECT * FROM user_practice_summary WHERE lower(cf_handle)=lower($1)", [handle]))[0] ?? null;
}
export async function tags(): Promise<string[]> {
  return (await query<{ name: string }>("SELECT name FROM tag WHERE EXISTS(SELECT 1 FROM problem_tag pt WHERE pt.tag_id=tag.tag_id) ORDER BY name")).map(r=>r.name);
}
export async function recommendations(profile: Profile, mode: Mode, limit = 5): Promise<Pick[]> {
  return query<Pick>(`SELECT r.*, ps.description AS statement, COALESCE((SELECT array_agg(t.name ORDER BY t.name) FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=r.problem_id),'{}') AS tags,
    CASE WHEN r.previous_attempts>0 THEN 'ATTEMPTED' ELSE NULL END AS verdict, r.previous_attempts AS attempts
    FROM recommend_practice($1,$2,$3) r LEFT JOIN problem_statement ps ON ps.problem_id=r.problem_id`, [profile.user_id,mode,limit]);
}
export async function dashboard(profile: Profile) {
  const [topics, recent, weeks, ratings, verdicts, days] = await Promise.all([
    query<Topic>(`SELECT t.name,uts.attempts,uts.accepted,uts.wrong_attempts,uts.proficiency,
      (SELECT count(DISTINCT s.problem_id) FROM submission s JOIN problem_tag pt USING(problem_id)
       WHERE s.user_id=$1 AND s.verdict='OK' AND pt.tag_id=t.tag_id) AS unique_solved
      FROM user_tag_stat uts JOIN tag t USING(tag_id) WHERE uts.user_id=$1 ORDER BY uts.attempts DESC,t.name LIMIT 10`,[profile.user_id]),
    query<Submission>(`SELECT s.*,p.contest_id,p.problem_index,p.name,p.rating FROM submission s JOIN problem p USING(problem_id)
      WHERE s.user_id=$1 ORDER BY submitted_at DESC LIMIT 12`,[profile.user_id]),
    query<{ week: Date; count: number }>(`WITH first_solves AS (
      SELECT problem_id,min(submitted_at) AS solved_at FROM submission WHERE user_id=$1 AND verdict='OK' GROUP BY problem_id)
      SELECT weeks.week,count(fs.problem_id) FROM generate_series(date_trunc('week',now() AT TIME ZONE 'UTC')-interval '7 weeks',
       date_trunc('week',now() AT TIME ZONE 'UTC'),interval '1 week') weeks(week)
      LEFT JOIN first_solves fs ON date_trunc('week',fs.solved_at AT TIME ZONE 'UTC')=weeks.week GROUP BY weeks.week ORDER BY weeks.week`,[profile.user_id]),
    query<{ name: string; new_rating: number; start_time: Date | null }>(`SELECT c.name,rc.new_rating,c.start_time FROM rating_change rc JOIN contest c USING(contest_id)
      WHERE rc.user_id=$1 ORDER BY c.start_time NULLS FIRST,c.contest_id`,[profile.user_id]),
    query<{ verdict: string; count: number }>("SELECT verdict,count(*) FROM submission WHERE user_id=$1 GROUP BY verdict ORDER BY count(*) DESC",[profile.user_id]),
    query<{ day: string }>("SELECT DISTINCT to_char(submitted_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day FROM submission WHERE user_id=$1 AND verdict='OK' ORDER BY day DESC",[profile.user_id]),
  ]);
  let streak=0;
  const today=Math.floor(Date.now()/86400000);
  if (days.length && today-Math.floor(Date.parse(days[0].day)/86400000)<=1) {
    let expected=Math.floor(Date.parse(days[0].day)/86400000);
    for (const row of days) { const day=Math.floor(Date.parse(row.day)/86400000); if(day!==expected) break; streak++; expected--; }
  }
  return { topics,recent,weeks,ratings,verdicts,streak };
}
const problemColumns = `p.*,COALESCE((SELECT array_agg(t.name ORDER BY t.name) FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id),'{}') AS tags,
  CASE WHEN EXISTS(SELECT 1 FROM submission s WHERE s.problem_id=p.problem_id AND s.user_id=$1 AND s.verdict='OK') THEN 'OK'
    ELSE (SELECT s.verdict FROM submission s WHERE s.problem_id=p.problem_id AND s.user_id=$1 ORDER BY submitted_at DESC LIMIT 1) END AS verdict,
  (SELECT count(*) FROM submission s WHERE s.problem_id=p.problem_id AND s.user_id=$1) AS attempts`;
export async function searchProblems(params: Params, userId: number | null) {
  const q=value(params,"q").trim().slice(0,200), tag=topicValues(params), status=value(params,"status");
  const min=integer(value(params,"min"),800,800,3500), max=integer(value(params,"max"),3500,800,3500);
  const page=integer(value(params,"page"),1,1,10000), sort=value(params,"sort","recent");
  const args: unknown[]=[userId]; const conditions:string[]=[];
  const bind=(item:unknown)=>{args.push(item);return `$${args.length}`;};
  if(q) {
    const id=problemKey(q);
    if(id) conditions.push(`p.contest_id=${bind(id.contest)} AND upper(p.problem_index)=${bind(id.index)}`);
    else { const ref=bind(q); conditions.push(`(to_tsvector('simple',p.name) @@ websearch_to_tsquery('simple',${ref}) OR p.name ILIKE '%'||${ref}||'%' OR EXISTS(SELECT 1 FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id AND t.name ILIKE '%'||${ref}||'%'))`); }
  }
  if(value(params,'min')||value(params,'max')) conditions.push(`p.rating BETWEEN ${bind(min)} AND ${bind(max)}`);
  for (const topic of tag) conditions.push(`EXISTS(SELECT 1 FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id AND t.name=${bind(topic)})`);
  if(status==='unsolved'&&userId) conditions.push("NOT EXISTS(SELECT 1 FROM submission s WHERE s.problem_id=p.problem_id AND s.user_id=$1 AND s.verdict='OK')");
  const where=conditions.length?'WHERE '+conditions.join(' AND '):'';
  const order=({rating_asc:'p.rating ASC NULLS LAST,p.contest_id DESC',rating_desc:'p.rating DESC NULLS LAST,p.contest_id DESC',popular:'p.solved_count DESC,p.contest_id DESC'} as Record<string,string>)[sort]??'p.contest_id DESC,p.problem_index';
  // Count uses $1 even when profile filtering is absent, keeping all placeholders typed.
  const [count,total]=await Promise.all([
    query<{ count:number }>(`SELECT count(*) FROM problem p WHERE ($1::bigint IS NULL OR $1 IS NOT NULL) ${where?'AND '+conditions.join(' AND '):''}`,args),
    query<{ count:number }>('SELECT count(*) FROM problem'),
  ]);
  const totalPages=Math.max(1,Math.ceil(count[0].count/25)), actualPage=Math.min(page,totalPages);
  const rows=await query<Problem>(`SELECT ${problemColumns} FROM problem p ${where} ORDER BY ${order} LIMIT 25 OFFSET ${bind((actualPage-1)*25)}`,args);
  return {rows,count:count[0].count,total:total[0].count,page:actualPage,totalPages,filters:{q,tag,min:value(params,'min')?min:'',max:value(params,'max')?max:'',status,sort}};
}
export async function problemDetails(contest: number,index:string,userId:number|null) {
  const rows=await query<Problem & { contest_name: string; description:string|null; input_format:string|null; output_format:string|null; note:string|null; examples:{input:string;output:string}[]|null; source_url:string|null }>(
    `SELECT ${problemColumns},c.name AS contest_name,ps.description,ps.input_format,ps.output_format,ps.note,ps.examples,ps.source_url
    FROM problem p JOIN contest c USING(contest_id) LEFT JOIN problem_statement ps USING(problem_id)
    WHERE p.contest_id=$2 AND upper(p.problem_index)=upper($3)`,[userId,contest,index]);
  const problem=rows[0]; if(!problem) return null;
  const [recent,similar]=await Promise.all([
    query<Submission>('SELECT s.*,p.contest_id,p.problem_index,p.name,p.rating FROM submission s JOIN problem p USING(problem_id) WHERE s.problem_id=$1 AND s.user_id=$2 ORDER BY submitted_at DESC LIMIT 10',[problem.problem_id,userId]),
    query<Problem>(`SELECT ${problemColumns} FROM problem p
      JOIN (SELECT pt.problem_id,count(*) AS shared FROM problem_tag pt JOIN problem_tag own ON own.tag_id=pt.tag_id
            WHERE own.problem_id=$2 AND pt.problem_id<>$2 GROUP BY pt.problem_id) related ON related.problem_id=p.problem_id
      ORDER BY related.shared DESC,abs(COALESCE(p.rating,1500)-$3),p.solved_count DESC LIMIT 5`,[userId,problem.problem_id,problem.rating??1500]),
  ]);
  return {problem,recent,similar};
}
