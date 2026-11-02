import 'server-only';
import {createHash} from 'node:crypto';
import {graphDriver,graphDatabase} from './neo4j';
import {query} from './db';
import {learningConfig,topicId,prerequisiteLevels,type LearningTopic,type LearningEdge} from './learning-graph';
import {practiceSnapshot,suggestedReview,type HistoryRow,type PracticeTopic,type SolvedConnection} from './learning-evidence';

export type LearningPlan={target:string;targets:string[];topics:PracticeTopic[];edges:LearningEdge[];levels:string[][];review:string[];version:string;handle:string};
export class LearningGraphUnavailable extends Error {}
export async function learningPath(userId:number,targetInput:string|string[]):Promise<LearningPlan>{
 const targets=[...new Set((Array.isArray(targetInput)?targetInput:[targetInput]).map(topicId))];
 if(!targets.length||targets.length>19)throw new Error('Choose at least one mapped topic.');
 const target=targets[0];
 // A single SQL snapshot supplies both the graph projection and displayed counts.
 const snapshot=(await query<{cf_handle:string;last_synced_at:Date|null;history:HistoryRow[]}>(`SELECT u.cf_handle,u.last_synced_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('key',p.contest_id||'/'||p.problem_index,
   'contest_id',p.contest_id,'problem_index',p.problem_index,'name',p.name,'rating',p.rating,
   'solved_at',s.submitted_at,'verdict',s.verdict,'tags',ARRAY(SELECT t.name FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id ORDER BY t.name))
   ORDER BY s.submission_id) FROM submission s JOIN problem p USING(problem_id) WHERE s.user_id=u.user_id),'[]'::jsonb) AS history
  FROM app_user u WHERE u.user_id=$1`,[userId]))[0];
 if(!snapshot)throw new Error('Unknown profile');
 const {evidence,solves}=practiceSnapshot(snapshot.history);
 const hash=createHash('sha256').update(JSON.stringify(solves)).digest('hex');
 const sourceUpdatedAt=snapshot.last_synced_at?.getTime()??0;
 let nodes:LearningTopic[],edges:LearningEdge[],version:string,connections:Map<string,SolvedConnection[]>;
 try{
  const session=graphDriver().session({database:graphDatabase()});
  try{
   const result=await session.executeWrite(async tx=>{
    const meta=await tx.run('MATCH(g:CoderiseGraph {key:$graph}) RETURN g.version AS version,g.projectionVersion AS projectionVersion',{graph:learningConfig.graph});
    if(meta.records[0]?.get('version')!==learningConfig.version||meta.records[0]?.get('projectionVersion')!==1)throw new LearningGraphUnavailable('Synchronize the learning map first.');
    const profileKey=learningConfig.graph+':profile:'+snapshot.cf_handle.toLowerCase();
    // This dependent update takes a per-profile lock before checking its snapshot hash.
    const lock=await tx.run(`MERGE(u:CoderiseProfile {key:$key})
      SET u.lock=coalesce(u.lock,0)+1,u.graph=$graph,u.handle=$handle
      RETURN u.snapshotHash AS hash,u.sourceUpdatedAt AS sourceUpdatedAt`,{key:profileKey,graph:learningConfig.graph,handle:snapshot.cf_handle});
    if((lock.records[0].get('sourceUpdatedAt')??0)>sourceUpdatedAt)throw new LearningGraphUnavailable('Practice history changed while building the map. Please reload.');
    if(lock.records[0].get('hash')!==hash){
     await tx.run('MATCH(u:CoderiseProfile {key:$key})-[r:SOLVED {graph:$graph}]->(:CoderiseProblem {graph:$graph}) DELETE r',{key:profileKey,graph:learningConfig.graph});
     await tx.run(`UNWIND $solves AS s MATCH(u:CoderiseProfile {key:$key})
      MERGE(p:CoderiseProblem {key:$graph+':problem:'+s.key})
      SET p.graph=$graph,p.cfKey=s.key,p.contest_id=s.contest_id,p.problem_index=s.problem_index,p.name=s.name,p.rating=s.rating
      MERGE(u)-[r:SOLVED {graph:$graph}]->(p) SET r.solved_at=s.solved_at`,{key:profileKey,graph:learningConfig.graph,solves});
     await tx.run(`UNWIND $solves AS s MATCH(p:CoderiseProblem {key:$graph+':problem:'+s.key})
      OPTIONAL MATCH(p)-[r:HAS_TAG {graph:$graph}]->(:CoderiseTopic {graph:$graph}) DELETE r`,{graph:learningConfig.graph,solves});
     await tx.run(`UNWIND $solves AS s MATCH(p:CoderiseProblem {key:$graph+':problem:'+s.key})
      UNWIND s.topics AS id MATCH(t:CoderiseTopic {graph:$graph,id:id})
      MERGE(p)-[:HAS_TAG {graph:$graph}]->(t)`,{graph:learningConfig.graph,solves});
    }
    await tx.run('MATCH(u:CoderiseProfile {key:$key}) SET u.snapshotHash=$hash,u.sourceUpdatedAt=$updated',{key:profileKey,hash,updated:sourceUpdatedAt});
    const graph=await tx.run(`MATCH(goal:CoderiseTopic {graph:$graph}) WHERE goal.id IN $targets
      MATCH p=(a:CoderiseTopic {graph:$graph})-[:PREREQUISITE_OF*0..12]->(goal)
      WHERE all(n IN nodes(p) WHERE n.graph=$graph) AND all(r IN relationships(p) WHERE r.graph=$graph)
      RETURN collect(p) AS paths`,{graph:learningConfig.graph,targets});
    const byId=new Map<string,LearningTopic>(),byEdge=new Map<string,LearningEdge>();
    for(const path of graph.records[0]?.get('paths')??[]){
     for(const n of [path.start,...path.segments.map((s:{end:unknown})=>s.end)]){const {id,name,tag,summary}=n.properties;byId.set(id,{id,name,tag,summary})}
     for(const segment of path.segments){const from=segment.start.properties.id,to=segment.end.properties.id;byEdge.set(from+':'+to,{from,to,reason:segment.relationship.properties.reason})}
    }
    if(!byId.size)throw new LearningGraphUnavailable('The target is missing from the map.');
    const connectionRows=await tx.run(`MATCH(u:CoderiseProfile {key:$key})-[r:SOLVED {graph:$graph}]->(p:CoderiseProblem {graph:$graph})
      -[:HAS_TAG {graph:$graph}]->(t:CoderiseTopic {graph:$graph}) WHERE t.id IN $ids
      WITH t,p,r ORDER BY r.solved_at DESC,p.cfKey
      RETURN t.id AS id,count(p) AS solved,collect(p{.contest_id,.problem_index,.name,.rating,key:p.cfKey,solved_at:r.solved_at})[0..3] AS problems`,
      {key:profileKey,graph:learningConfig.graph,ids:[...byId.keys()]});
    return {nodes:[...byId.values()],edges:[...byEdge.values()],version:meta.records[0].get('version') as string,
      connections:new Map<string,SolvedConnection[]>(connectionRows.records.map(r=>{
       if(r.get('solved')!==(evidence.get(r.get('id'))?.solved.size??0))throw new LearningGraphUnavailable('Practice projection needs a refresh.');
       return [r.get('id'),r.get('problems')];
      }))};
   },{timeout:10000});
   ({nodes,edges,version,connections}=result);
  }finally{await session.close()}
 }catch(error){if(error instanceof LearningGraphUnavailable)throw error;throw new LearningGraphUnavailable('The learning map is temporarily unavailable.')}
 const levels=prerequisiteLevels(nodes,edges).map(level=>level.map(t=>t.id).sort());
 if(nodes.some(n=>(evidence.get(n.id)?.solved.size??0)>0&&!connections.has(n.id)))throw new LearningGraphUnavailable('Practice projection needs a refresh.');
 const topics=nodes.map(n=>{const e=evidence.get(n.id);return {...n,solved:e?.solved.size??0,attempts:e?.attempts??0,accepted:e?.accepted??0,solvedProblems:connections.get(n.id)??[]}});
 return {target,targets,topics,edges,levels,review:suggestedReview(topics,levels,targets),version,handle:snapshot.cf_handle};
}
