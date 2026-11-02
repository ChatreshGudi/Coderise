import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparationProblemKey,preparationBand,distributePractice,type PracticeProblem} from '../lib/preparation-rules';

test('problem preparation accepts visible Codeforces IDs and canonical contest/problemset links',()=>{
 for(const input of ['1879C','1879/C',' 1879 c ','https://codeforces.com/contest/1879/problem/C','https://codeforces.com/problemset/problem/1879/C?locale=en#section','https://www.codeforces.com/problemset/problem/1879/c/'])assert.deepEqual(preparationProblemKey(input),{contest:1879,index:'C'});
 assert.deepEqual(preparationProblemKey('https://codeforces.com/contest/1764/problem/G3'),{contest:1764,index:'G3'});
});
test('foreign URLs, credentials, invalid IDs and commands are rejected without fetching anything',()=>{
 for(const input of ['https://evil.example/contest/1879/problem/C','https://codeforces.com.evil.example/contest/1879/problem/C','javascript:alert(1)','https://user:secret@codeforces.com/contest/1879/problem/C','file:///1879C','0A','https://codeforces.com/contest/0/problem/A','999999999A',"1A'; DROP TABLE problem;--",'x'.repeat(401),'https://codeforces.com/contest/%ZZ/problem/A'])assert.equal(preparationProblemKey(input),null,input);
});
test('practice stays below the target and adapts to the learner rather than jumping to its difficulty',()=>{
 const beginner=preparationBand(1000,2000);assert.equal(beginner.center,900);assert.ok(beginner.max<2000);
 const advanced=preparationBand(2800,1500);assert.ok(advanced.max<1500);assert.ok(advanced.min<=advanced.max);
 for(let user=800;user<=3500;user+=100)for(let target=900;target<=3500;target+=100){const band=preparationBand(user,target);assert.ok(band.min>=800&&band.max<target&&band.min<=band.max)}
});
test('minimum-rated and unrated targets have explicit honest fallback modes',()=>{
 const minimum=preparationBand(1000,800);assert.equal(minimum.relation,'same-minimum-rating');assert.equal(minimum.min,800);assert.equal(minimum.max,800);
 const unrated=preparationBand(1000,null);assert.equal(unrated.relation,'unrated-target');assert.ok(unrated.max<=3500&&unrated.min>=800);
});
test('topic practice is bounded and never repeats the same problem across a preparation plan',()=>{
 const base:PracticeProblem={problem_id:1,contest_id:1,problem_index:'A',name:'Fixture',rating:800,solved_count:1,reason:'Fixture'};
 const candidates=['math','implementation'].flatMap(tag=>Array.from({length:6},(_,i)=>({...base,problem_id:i+1,tag})));
 const result=distributePractice([{tag:'math',name:'Math'},{tag:'implementation',name:'Implementation'}],candidates);
 const ids=result.flatMap(t=>t.problems.map(p=>p.problem_id));assert.equal(ids.length,6);assert.equal(new Set(ids).size,6);assert.ok(result.every(t=>t.problems.length===3));
 assert.deepEqual(distributePractice([{tag:'empty',name:'Empty'}],[])[0].problems,[]);
});
