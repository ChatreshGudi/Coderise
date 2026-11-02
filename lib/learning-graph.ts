import config from '../config/learning-topics.json';

export type LearningTopic={id:string;name:string;tag:string;summary:string};
export type LearningEdge={from:string;to:string;reason:string};
export const learningConfig=config;
export const learningTopics:LearningTopic[]=config.topics;
export function topicId(input:string):string {
  if(!learningTopics.some(t=>t.id===input))throw new Error('Choose a topic from the learning map.');
  return input;
}
// Several branches may be needed together. A shortest route alone cannot describe them.
export function prerequisiteLevels(topics:LearningTopic[],edges:LearningEdge[]):LearningTopic[][] {
  const ids=new Set(topics.map(t=>t.id));
  if(ids.size!==topics.length)throw new Error('Duplicate topic IDs');
  if(edges.some(e=>!ids.has(e.from)||!ids.has(e.to)||e.from===e.to))throw new Error('Invalid prerequisite edge');
  const pending=new Set(ids),done=new Set<string>(),levels:LearningTopic[][]=[];
  while(pending.size){
    const next=topics.filter(t=>pending.has(t.id)&&edges.filter(e=>e.to===t.id).every(e=>done.has(e.from)));
    if(!next.length)throw new Error('Prerequisite graph must be acyclic');
    levels.push(next);next.forEach(t=>{pending.delete(t.id);done.add(t.id)});
  }
  return levels;
}
