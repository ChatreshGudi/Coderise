/** Read-only application/API checks and a before/after review artifact. */
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadEnvConfig } from '@next/env';
import type { Mode } from '../lib/validation';
import retrievalConfig from '../config/retrieval.json';

async function main() {
  loadEnvConfig(process.cwd());
  const { query,pool }=await import('../lib/db');
  const { getProfile,recommendationBatch }=await import('../lib/data');
  const { GET }=await import('../app/api/recommendations/route');
  const previous=process.env.CODERISE_SEMANTIC_RECOMMENDATIONS;
  const comparison=[];
  try {
    const handles=await query<{cf_handle:string}>('SELECT cf_handle FROM app_user ORDER BY user_id');
    for(const {cf_handle:handle} of handles) {
      const profile=await getProfile(handle); assert.ok(profile);
      const accepted=new Set((await query<{problem_id:number}>("SELECT DISTINCT problem_id FROM submission WHERE user_id=$1 AND verdict='OK'",[profile.user_id])).map(r=>r.problem_id));
      for(const mode of ['warm_up','stretch','fix_weaknesses'] as Mode[]) {
        process.env.CODERISE_SEMANTIC_RECOMMENDATIONS='0';
        const baseline=await recommendationBatch(profile,mode);
        assert.equal(baseline.strategy,'topic_difficulty_baseline');
        const original:{problem_id:number;score:number}[]=await query<{problem_id:number;score:number}>('SELECT problem_id,score FROM recommend_practice($1,$2,5)',[profile.user_id,mode]);
        assert.deepEqual(baseline.problems.map(({problem_id,score})=>({problem_id,score})),original);
        process.env.CODERISE_SEMANTIC_RECOMMENDATIONS='1';
        const start=performance.now();
        const hybrid=await recommendationBatch(profile,mode);
        const milliseconds=Math.round(performance.now()-start);
        const eligible=new Set((await query<{problem_id:number}>('SELECT problem_id FROM recommend_practice_candidates($1,$2,500)',[profile.user_id,mode])).map(r=>r.problem_id));
        for(const pick of hybrid.problems) {
          assert.ok(eligible.has(pick.problem_id)&&!accepted.has(pick.problem_id));
          assert.ok(Number.isFinite(pick.score)&&pick.score>=0&&pick.score<=1);
          assert.ok(!('editorial_vector' in pick)&&!('statement_vector' in pick)&&!('body' in pick));
        }
        const response=await GET(new Request(`http://localhost/api/recommendations?handle=${encodeURIComponent(handle)}&mode=${mode}`));
        assert.equal(response.status,200);
        const payload=await response.json();
        assert.ok(['topic_difficulty_baseline','pgvector_hybrid'].includes(payload.strategy));
        assert.equal(payload.mode,mode);
        assert.ok(payload.problems.every((p:{problem_id:number})=>!accepted.has(p.problem_id)));
        const compact=(p:(typeof hybrid.problems)[number])=>({key:`${p.contest_id}/${p.problem_index}`,name:p.name,rating:p.rating,score:p.score,
          baseline_score:p.baseline_score,similarity_source:p.similarity_source,semantic_similarity:p.semantic_similarity,
          semantic_adjustment:p.semantic_adjustment,reason:p.reason});
        comparison.push({handle,mode,strategy:hybrid.strategy,references:hybrid.references,milliseconds,baseline:baseline.problems.map(compact),hybrid:hybrid.problems.map(compact)});
      }
    }
    await mkdir('reports',{recursive:true});
    const coverage=(await query(`SELECT count(*) AS catalogue_problems,
      count(*) FILTER(WHERE pe.status='ready') AS editorial_tier,
      count(*) FILTER(WHERE COALESCE(pe.status,'')<>'ready' AND ps.problem_id IS NOT NULL) AS statement_tier,
      count(*) FILTER(WHERE COALESCE(pe.status,'')<>'ready' AND ps.problem_id IS NULL) AS catalogue_only_tier
      FROM problem p LEFT JOIN problem_editorial pe USING(problem_id) LEFT JOIN problem_statement ps USING(problem_id)`))[0];
    const embeddings=await query('SELECT source_kind,count(*) AS count FROM retrieval_current_embedding WHERE model=$1 AND model_revision=$2 AND recipe=$3 GROUP BY source_kind',
      [retrievalConfig.model,retrievalConfig.revision,retrievalConfig.recipe]);
    await writeFile('reports/retrieval_coverage.json',JSON.stringify({sources:coverage,embeddings},null,2));
    await writeFile('reports/recommendation_comparison.json',JSON.stringify(comparison,null,2));
    const lines=['# Recommendation comparison','','Functional check and review aid; this is not evidence of better learning outcomes. Similarity is not solve probability.',''];
    for(const row of comparison) {
      lines.push(`## ${row.handle}: ${row.mode}`,`Strategy: ${row.strategy}; ${row.milliseconds} ms`,'',
        '| Rank | Baseline | Coverage-aware | Similarity source | Adjustment |','|---|---|---|---|---|');
      row.hybrid.forEach((pick,i)=>lines.push(`| ${i+1} | ${row.baseline[i]?.key??''} | ${pick.key}: ${pick.name} | ${pick.similarity_source??'baseline'} | ${(pick.semantic_adjustment??0).toFixed(4)} |`));
      lines.push('');
    }
    await writeFile('reports/recommendation_comparison.md',lines.join('\n'));
    console.log(`Application/API checks passed for ${comparison.length} profile/mode combinations. Review reports/recommendation_comparison.md`);
  } finally {
    if(previous===undefined) delete process.env.CODERISE_SEMANTIC_RECOMMENDATIONS;
    else process.env.CODERISE_SEMANTIC_RECOMMENDATIONS=previous;
    await pool.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
