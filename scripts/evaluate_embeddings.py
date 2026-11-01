"""Local embedding benchmark. Tag overlap is a proxy, not a human relevance label."""
from pathlib import Path
import argparse, hashlib, importlib.metadata, json, os, time
import numpy as np
import torch
from dotenv import load_dotenv
from huggingface_hub import HfApi
from sentence_transformers import SentenceTransformer
from import_codeforces_catalog import db_connect
print("Dependencies loaded.", flush=True)
ROOT=Path(__file__).resolve().parents[1]
GENERIC={'implementation','math','greedy','brute force','constructive algorithms','*special'}
MODELS=['sentence-transformers/all-MiniLM-L6-v2','sentence-transformers/all-mpnet-base-v2']
MODEL_REVISIONS={'sentence-transformers/all-MiniLM-L6-v2': '1110a243fdf4706b3f48f1d95db1a4f5529b4d41', 'sentence-transformers/all-mpnet-base-v2': 'e8c3b32edf5434bc2275fc9bab85f82640a19130'}

def stable(value): return hashlib.sha256(('coderise-eval-v1:'+str(value)).encode()).hexdigest()
def normalize(a): return a/np.maximum(np.linalg.norm(a,axis=-1,keepdims=True),1e-12)
def ndcg(rel,order,k=10):
    discounts=1/np.log2(np.arange(2,k+2)); ideal=np.sort(rel)[::-1][:k]@discounts
    return float(rel[order[:k]]@discounts/ideal) if ideal else 0.0

def load_corpus(size=800, fresh_sample=False):
    load_dotenv(ROOT/'.env')
    with db_connect() as conn:
        rows=conn.execute('''SELECT p.problem_id,p.contest_id,p.problem_index,p.name,p.rating,
            ps.description,ps.input_format,ps.output_format,ps.source_problem_id,ps.source_revision,
            array_agg(t.name ORDER BY t.name)
            FROM problem p JOIN problem_statement ps USING(problem_id)
            JOIN problem_tag pt USING(problem_id) JOIN tag t USING(tag_id)
            WHERE p.rating IS NOT NULL AND length(trim(ps.description))>=80
            GROUP BY p.problem_id,ps.problem_id ORDER BY p.contest_id,p.problem_index''').fetchall()
    seen=set(); records=[]
    for pid,contest,index,name,rating,desc,inp,out,source,revision,tags in rows:
        signature=hashlib.sha256(' '.join((desc+' '+inp+' '+out).split()).encode()).hexdigest()
        if signature in seen: continue
        seen.add(signature)
        records.append(dict(id=pid,contest=contest,index=index,name=name,rating=rating,description=desc,
                            input=inp,output=out,source_id=source,revision=revision,tags=tags))
    manifest=ROOT/'docs'/'embedding_evaluation_manifest.json'
    if manifest.exists() and not fresh_sample:
        keys=json.loads(manifest.read_text())['problem_keys']
        by_key={f"{r['contest']}/{r['index']}":r for r in records}
        if any(key not in by_key for key in keys):
            raise RuntimeError('Original benchmark problems missing; import the pinned statements or use --fresh-sample.')
        return [by_key[key] for key in keys]
    return sorted(records,key=lambda row:stable(row['id']))[:size]

def embed(records,name,folder):
    print("Resolving model: " + name, flush=True)
    revision=HfApi().model_info(name,revision=MODEL_REVISIONS[name]).sha
    start=time.perf_counter(); model=SentenceTransformer(name,revision=revision,device='cpu')
    load_seconds=time.perf_counter()-start; model.max_seq_length=256
    chunks=[]; owners=[]; weights=[]
    for i,row in enumerate(records):
        text=row['name']+'\n'+row['description']+'\nInput: '+row['input']+'\nOutput: '+row['output']
        ids=model.tokenizer.encode(text,add_special_tokens=False,verbose=False)
        for offset in range(0,len(ids),192):
            part=ids[offset:offset+224]
            if not part: break
            chunks.append(model.tokenizer.decode(part,skip_special_tokens=True)); owners.append(i); weights.append(len(part))
            if offset+224>=len(ids): break
    print(f'{name}: encoding {len(chunks)} chunks for {len(records)} problems',flush=True)
    start=time.perf_counter(); encoded=[]
    for offset in range(0,len(chunks),32):
        encoded.append(model.encode(chunks[offset:offset+32],batch_size=16,normalize_embeddings=True,show_progress_bar=False))
        if offset%320==0: print(f'  {min(offset+32,len(chunks))}/{len(chunks)} chunks',flush=True)
    encoded=np.concatenate(encoded); pooled=np.zeros((len(records),encoded.shape[1]),dtype=np.float32)
    for vec,owner,weight in zip(encoded,owners,weights): pooled[owner]+=vec*weight
    pooled=normalize(pooled); elapsed=time.perf_counter()-start
    np.save(folder/(name.split('/')[-1]+'.npy'),pooled)
    return pooled,dict(revision=revision,dimensions=pooled.shape[1],chunks=len(chunks),load_seconds=round(load_seconds,2),encode_seconds=round(elapsed,2))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fresh-sample',action='store_true',help='Choose a new sample instead of the original manifest.')
    args=parser.parse_args()
    torch.set_num_threads(min(4,os.cpu_count() or 1))
    print("Reading benchmark corpus...", flush=True)
    records=load_corpus(fresh_sample=args.fresh_sample); folder=ROOT/'reports'/'embedding_evaluation'; folder.mkdir(parents=True,exist_ok=True)
    (folder/'corpus.json').write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8')
    tags=sorted({t for row in records for t in row['tags']})
    raw=np.array([[t in row['tags'] for t in tags] for row in records],dtype=float)
    idf=np.log((1+len(records))/(1+raw.sum(axis=0)))+1
    weighted=normalize(raw*idf); tag_scores=weighted@weighted.T; specific=raw.copy()
    for j,t in enumerate(tags):
        if t in GENERIC: specific[:,j]=0
    queries=[i for i,row in enumerate(records) if specific[i].sum()>0][:120]
    validation=queries[::2]; test=queries[1::2]
    semantic={}; metadata={}
    for name in MODELS:
        vectors,meta=embed(records,name,folder); semantic[name]=vectors@vectors.T; metadata[name]=meta
    def metrics(scores,indices,examples=False):
        values=[]; pairs=[]
        for q in indices:
            eligible=np.array([i for i,row in enumerate(records) if i!=q and row['contest']!=records[q]['contest']
                               and row['source_id']!=records[q]['source_id'] and row['name'].casefold()!=records[q]['name'].casefold()
                               and abs(row['rating']-records[q]['rating'])<=400])
            intersection=(specific[eligible]*specific[q]*idf).sum(axis=1)
            union=(np.maximum(specific[eligible],specific[q])*idf).sum(axis=1)
            relevance=intersection/np.maximum(union,1e-12)
            if len(eligible)<10 or relevance.max()==0: continue
            order=np.argsort(-scores[q,eligible],kind='stable')
            values.append((ndcg(relevance,order),float(np.mean(intersection[order[:5]]>0)),float(np.mean(relevance[order[:5]]))))
            if examples and len(pairs)<12:
                pairs.append(dict(query_id=records[q]['id'],matches=[records[i]['id'] for i in eligible[order[:5]]]))
        values=np.array(values)
        return dict(queries=len(values),ndcg_at_10=round(float(values[:,0].mean()),4),specific_tag_precision_at_5=round(float(values[:,1].mean()),4),weighted_tag_jaccard_at_5=round(float(values[:,2].mean()),4),per_query_metrics=values.tolist()),pairs
    output=dict(corpus_size=len(records),query_count=len(queries),validation_queries=len(validation),test_queries=len(test),
                protocol='Tag-overlap proxy, not human relevance or learning outcomes. No tags in model input. Rating band +/-400; same contest/title/source and identical statement text excluded.',
                packages={name:importlib.metadata.version(name) for name in ['torch','sentence-transformers','transformers','numpy']},
                model_metadata=metadata,results={},examples={})
    output['results']['random'],_=metrics(np.random.default_rng(42).random(tag_scores.shape),test)
    output['results']['tag_only'],output['examples']['tag_only']=metrics(tag_scores,test,True)
    for name,scores in semantic.items():
        output['results'][name],output['examples'][name]=metrics(scores,test,True)
        weights={w:metrics((1-w)*tag_scores+w*scores,validation)[0]['ndcg_at_10'] for w in [0.0,0.1,0.2,0.3,0.4,0.5]}
        chosen=max(weights,key=lambda w:(weights[w],-w)); key=name+'+tags'
        output['results'][key],output['examples'][key]=metrics((1-chosen)*tag_scores+chosen*scores,test,True)
        output['results'][key].update(semantic_weight=chosen,validation_weight_scores=weights)
    a=np.array(output['results'][MODELS[0]]['per_query_metrics'])
    b=np.array(output['results'][MODELS[1]]['per_query_metrics'])
    rng=np.random.default_rng(123); samples=rng.integers(0,len(a),(10000,len(a)))
    output['mpnet_minus_minilm_uncertainty']={}
    for column,label in [(0,'ndcg_at_10'),(1,'specific_tag_precision_at_5')]:
        diff=b[:,column]-a[:,column]
        output['mpnet_minus_minilm_uncertainty'][label]=dict(mean_difference=float(diff.mean()),paired_bootstrap_95_percent_interval=np.quantile(diff[samples].mean(axis=1),[0.025,0.975]).tolist())
    (folder/'results.json').write_text(json.dumps(output,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in output.items() if k!='examples'},indent=2),flush=True)
if __name__=='__main__': main()
