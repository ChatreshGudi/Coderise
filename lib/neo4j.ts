import 'server-only';
import neo4j,{type Driver} from 'neo4j-driver';
const globalGraph=globalThis as unknown as {coderiseNeo4j?:Driver};
export function graphDriver():Driver {
  const {NEO4J_URI:uri,NEO4J_USER:user,NEO4J_PASSWORD:password}=process.env;
  if(!uri||!user||!password)throw new Error('Neo4j connection is not configured.');
  return globalGraph.coderiseNeo4j??=neo4j.driver(uri,neo4j.auth.basic(user,password),{
    connectionTimeout:2500,connectionAcquisitionTimeout:3500,maxTransactionRetryTime:2000,
    maxConnectionPoolSize:8,disableLosslessIntegers:true,
  });
}
export function graphDatabase(){return process.env.NEO4J_DATABASE||'neo4j';}
