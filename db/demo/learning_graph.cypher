// Run each section separately in Neo4j Query/Browser against the configured database.
// Only the Coderise-managed graph is read. No writes or APOC dependency.

// 1. Visualize the complete curated roadmap.
MATCH p=(a:CoderiseTopic {graph:'coderise-prerequisites'})
 -[:PREREQUISITE_OF {graph:'coderise-prerequisites'}]->
 (b:CoderiseTopic {graph:'coderise-prerequisites'})
RETURN p;

// 2. All background branches for disjoint-set union (not just one route).
MATCH p=(a:CoderiseTopic {graph:'coderise-prerequisites'})
 -[:PREREQUISITE_OF*1..12]->
 (target:CoderiseTopic {graph:'coderise-prerequisites',id:'dsu'})
WHERE all(r IN relationships(p) WHERE r.graph='coderise-prerequisites')
RETURN p;

// 3. A shortest route to flows. This does not replace the other background branches.
MATCH (a:CoderiseTopic {graph:'coderise-prerequisites',id:'implementation'}),
      (b:CoderiseTopic {graph:'coderise-prerequisites',id:'flows'})
MATCH p=allShortestPaths((a)-[:PREREQUISITE_OF*1..12]->(b))
WHERE all(n IN nodes(p) WHERE n.graph='coderise-prerequisites')
 AND all(r IN relationships(p) WHERE r.graph='coderise-prerequisites')
RETURN [n IN nodes(p)|n.name] AS route,length(p) AS hops ORDER BY route LIMIT 1;

// 4. Reasons behind incoming background connections.
MATCH (a:CoderiseTopic {graph:'coderise-prerequisites'})
 -[r:PREREQUISITE_OF {graph:'coderise-prerequisites'}]->
 (b:CoderiseTopic {graph:'coderise-prerequisites',id:'dsu'})
RETURN a.name AS background,b.name AS target,r.reason AS why ORDER BY background;

// 5. Indexed identity constraints and version metadata.
SHOW CONSTRAINTS YIELD name,type,labelsOrTypes,properties
WHERE name IN ['coderise_topic_key','coderise_graph_key','coderise_profile_key','coderise_problem_key']
RETURN name,type,labelsOrTypes,properties;

MATCH (g:CoderiseGraph {key:'coderise-prerequisites'}) RETURN g;

// 6. Real imported practice connections (open Petr's learning map first).
MATCH p=(u:CoderiseProfile {graph:'coderise-prerequisites',handle:'Petr'})
 -[:SOLVED {graph:'coderise-prerequisites'}]->(:CoderiseProblem {graph:'coderise-prerequisites'})
 -[:HAS_TAG {graph:'coderise-prerequisites'}]->(t:CoderiseTopic {graph:'coderise-prerequisites',id:'flows'})
RETURN p LIMIT 15;

// 7. Accepted-problem evidence that connects to a goal or its background.
MATCH (goal:CoderiseTopic {graph:'coderise-prerequisites',id:'flows'})
MATCH background=(t:CoderiseTopic {graph:'coderise-prerequisites'})-[:PREREQUISITE_OF*0..12]->(goal)
WHERE all(r IN relationships(background) WHERE r.graph='coderise-prerequisites')
WITH DISTINCT t
MATCH (u:CoderiseProfile {graph:'coderise-prerequisites',handle:'Petr'})
 -[s:SOLVED {graph:'coderise-prerequisites'}]->(p:CoderiseProblem {graph:'coderise-prerequisites'})
 -[:HAS_TAG {graph:'coderise-prerequisites'}]->(t)
RETURN t.name AS topic,p.cfKey AS problem,p.name AS title,s.solved_at AS accepted_at
ORDER BY accepted_at DESC,problem LIMIT 15;
