import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const neo4j=require('neo4j-driver');
const {Client}=require('pg');
const config=JSON.parse(await readFile('config/learning-topics.json','utf8'));
const ids=new Set(config.topics.map(t=>t.id));
if(ids.size!==config.topics.length||config.edges.some(e=>!ids.has(e.from)||!ids.has(e.to)||e.from===e.to))throw new Error('Invalid graph IDs/edges');
const done=new Set();
while(done.size<ids.size){const ready=[...ids].filter(id=>!done.has(id)&&config.edges.filter(e=>e.to===id).every(e=>done.has(e.from)));if(!ready.length)throw new Error('Graph contains a cycle');ready.forEach(id=>done.add(id))}
let driver;
const pg=new Client({host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE,user:process.env.PGUSER,password:process.env.PGPASSWORD});
try{
 if(!process.env.NEO4J_URI||!process.env.NEO4J_USER||!process.env.NEO4J_PASSWORD)throw new Error('Set NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD in .env first.');
 await pg.connect();
 const tags=new Set((await pg.query('SELECT name FROM tag')).rows.map(t=>t.name));
 if(config.topics.some(t=>!tags.has(t.tag)))throw new Error('The PostgreSQL catalogue is missing a configured topic tag. Import the catalogue first.');
 driver=neo4j.driver(process.env.NEO4J_URI,neo4j.auth.basic(process.env.NEO4J_USER,process.env.NEO4J_PASSWORD),{connectionTimeout:5000,maxTransactionRetryTime:3000});
 const session=driver.session({database:process.env.NEO4J_DATABASE||'neo4j'});
 try{
  await session.run('CREATE CONSTRAINT coderise_topic_key IF NOT EXISTS FOR (t:CoderiseTopic) REQUIRE t.key IS UNIQUE');
  await session.run('CREATE CONSTRAINT coderise_graph_key IF NOT EXISTS FOR (g:CoderiseGraph) REQUIRE g.key IS UNIQUE');
  await session.run('CREATE CONSTRAINT coderise_profile_key IF NOT EXISTS FOR (u:CoderiseProfile) REQUIRE u.key IS UNIQUE');
  await session.run('CREATE CONSTRAINT coderise_problem_key IF NOT EXISTS FOR (p:CoderiseProblem) REQUIRE p.key IS UNIQUE');
  await session.executeWrite(async tx=>{
   await tx.run(`UNWIND $topics AS t MERGE(n:CoderiseTopic {key:$graph+':'+t.id}) SET n.graph=$graph,n.id=t.id,n.name=t.name,n.tag=t.tag,n.summary=t.summary,n.version=$version`,{...config});
   await tx.run('MATCH(a:CoderiseTopic {graph:$graph})-[r:PREREQUISITE_OF {graph:$graph}]->(b:CoderiseTopic {graph:$graph}) DELETE r',{graph:config.graph});
   await tx.run(`UNWIND $edges AS e MATCH(a:CoderiseTopic {key:$graph+':'+e.from}),(b:CoderiseTopic {key:$graph+':'+e.to})
     MERGE(a)-[r:PREREQUISITE_OF {graph:$graph}]->(b) SET r.reason=e.reason,r.version=$version`,{...config});
   await tx.run('MATCH(:CoderiseProblem {graph:$graph})-[r:HAS_TAG {graph:$graph}]->(t:CoderiseTopic {graph:$graph}) WHERE NOT t.id IN $ids DELETE r',{graph:config.graph,ids:[...ids]});
   await tx.run('MATCH(t:CoderiseTopic {graph:$graph}) WHERE NOT t.id IN $ids DELETE t',{graph:config.graph,ids:[...ids]});
   await tx.run('MERGE(g:CoderiseGraph {key:$graph}) SET g.version=$version,g.updated_at=datetime(),g.curated=true,g.projectionVersion=1',{graph:config.graph,version:config.version});
  });
 }finally{await session.close()}
 console.log(`Learning graph synchronized: ${ids.size} topics, ${config.edges.length} recommended-background relationships (${config.version}).`);
}catch(error){console.error('Learning graph sync failed:',error.code||error.message);process.exitCode=1}
finally{await pg.end();if(driver)await driver.close()}
