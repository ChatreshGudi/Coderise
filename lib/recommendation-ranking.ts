import config from '../config/retrieval.json';

export type TextSource = 'editorial' | 'statement';
export type RetrievalVectors = {
  editorial_vector: number[] | null; editorial_hash: string | null;
  statement_vector: number[] | null; statement_hash: string | null;
};
export type RankingCandidate = RetrievalVectors & {
  problem_id: number; score: number; solved_count: number;
};
export type RankingDecision = {
  problem_id: number; score: number; baseline_score: number; semantic_adjustment: number;
  similarity_source: TextSource | null; semantic_similarity: number | null;
};

export function cosine(a: number[] | null, b: number[] | null): number | null {
  if (!a || !b || a.length !== config.dimensions || b.length !== config.dimensions) return null;
  let dot=0, aa=0, bb=0;
  for(let i=0;i<a.length;i++) {
    if(!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return null;
    dot+=a[i]*b[i]; aa+=a[i]*a[i]; bb+=b[i]*b[i];
  }
  if(aa<=1e-12 || bb<=1e-12) return null;
  return Math.max(-1,Math.min(1,dot/Math.sqrt(aa*bb)));
}

function similarity(candidate: RetrievalVectors, anchors: RetrievalVectors[], kind: TextSource): number | null {
  const values: number[]=[];
  const vector=candidate[`${kind}_vector`], hash=candidate[`${kind}_hash`];
  if(!hash) return null;
  for(const anchor of anchors) {
    // Repeated editorial text / alias copies are not independent evidence.
    if(!anchor[`${kind}_hash`] || hash===anchor[`${kind}_hash`]) continue;
    const score=cosine(vector,anchor[`${kind}_vector`]);
    if(score!==null) values.push(score);
  }
  if(!values.length) return null;
  values.sort((a,b)=>b-a);
  const top=values.slice(0,3);
  return top.reduce((sum,value)=>sum+value,0)/top.length;
}

export function rankWithCoverage(candidates: RankingCandidate[], anchors: RetrievalVectors[], limit: number): RankingDecision[] {
  if(!Number.isInteger(limit) || limit<1 || limit>20) throw new Error('Limit must be 1 to 20');
  const decisions=candidates.map(row=>({
    problem_id:row.problem_id, score:row.score, baseline_score:row.score, semantic_adjustment:0,
    similarity_source:null as TextSource|null, semantic_similarity:null as number|null,
  }));
  const groups: Record<TextSource,{index:number;similarity:number}[]>={editorial:[],statement:[]};
  candidates.forEach((row,index)=>{
    const editorial=similarity(row,anchors,'editorial');
    if(editorial!==null) groups.editorial.push({index,similarity:editorial});
    else {
      const statement=similarity(row,anchors,'statement');
      if(statement!==null) groups.statement.push({index,similarity:statement});
    }
  });
  for(const kind of ['editorial','statement'] as const) {
    const group=groups[kind];
    // Tiny pools cannot support a useful within-channel comparison.
    if(group.length<5) continue;
    const ordered=group.map(row=>row.similarity).sort((a,b)=>a-b);
    const weight=kind==='editorial'?config.editorialWeight:config.statementWeight;
    for(const row of group) {
      const low=ordered.findIndex(value=>value>=row.similarity-1e-8);
      let high=ordered.length-1;
      while(high>low && ordered[high]>row.similarity+1e-8) high--;
      const centered=2*((low+high)/2)/(ordered.length-1)-1;
      const decision=decisions[row.index];
      decision.score=Math.max(0,Math.min(1,decision.baseline_score+weight*centered));
      decision.semantic_adjustment=decision.score-decision.baseline_score;
      decision.similarity_source=kind;
      decision.semantic_similarity=row.similarity;
    }
  }
  const byId=new Map(candidates.map(row=>[row.problem_id,row]));
  return decisions.sort((a,b)=>b.score-a.score
    || (byId.get(b.problem_id)!.solved_count-byId.get(a.problem_id)!.solved_count)
    || a.problem_id-b.problem_id).slice(0,limit);
}
