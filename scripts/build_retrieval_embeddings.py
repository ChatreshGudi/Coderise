"""Cache editorial and statement embeddings with a pinned CPU MiniLM encoder."""
import argparse
import importlib.metadata
import json
import time

import numpy as np
from dotenv import load_dotenv

from import_codeforces_catalog import db_connect
from retrieval_common import ROOT, CONFIG, atomic_json, text_hash


def token_windows(ids, window, stride):
    if not ids:
        raise ValueError("Cannot embed empty text")
    result = []
    for start in range(0, len(ids), stride):
        part = ids[start:start+window]
        result.append(part)
        if start+window >= len(ids):
            break
    return result


def normalized(values):
    values = np.asarray(values, dtype=np.float32)
    norm = np.linalg.norm(values, axis=-1, keepdims=True)
    if not np.all(np.isfinite(values)) or np.any(norm <= 1e-12):
        raise ValueError("Encoder produced a zero or non-finite vector")
    return values / norm


class Encoder:
    def __init__(self, threads=4):
        import onnxruntime as ort
        from huggingface_hub import hf_hub_download
        from tokenizers import Tokenizer
        cache = ROOT / "reports/model_cache"
        kwargs = dict(repo_id=CONFIG["model"], revision=CONFIG["revision"], cache_dir=cache)
        print("Loading pinned MiniLM ONNX CPU encoder...", flush=True)
        self.tokenizer = Tokenizer.from_file(hf_hub_download(filename="tokenizer.json", **kwargs))
        self.tokenizer.no_truncation()
        self.tokenizer.no_padding()
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(hf_hub_download(filename="onnx/model.onnx", **kwargs),
                                           sess_options=options, providers=["CPUExecutionProvider"])
        self.special = [self.tokenizer.token_to_id(token) for token in ["[CLS]", "[SEP]", "[PAD]"]]
        if any(value is None for value in self.special):
            raise ValueError("Unexpected tokenizer special tokens")

    def encode(self, texts):
        cls, sep, pad = self.special
        chunks, owners, weights = [], [], []
        for owner, text in enumerate(texts):
            ids = self.tokenizer.encode(text, add_special_tokens=False).ids
            for part in token_windows(ids, CONFIG["window"], CONFIG["stride"]):
                chunks.append([cls]+part+[sep])
                owners.append(owner)
                weights.append(len(part))
        pooled = np.zeros((len(texts), CONFIG["dimensions"]), dtype=np.float32)
        counts = [0] * len(texts)
        for offset in range(0, len(chunks), 16):
            batch = chunks[offset:offset+16]
            length = max(map(len, batch))
            ids = np.full((len(batch), length), pad, dtype=np.int64)
            mask = np.zeros_like(ids)
            for i, part in enumerate(batch):
                ids[i, :len(part)] = part
                mask[i, :len(part)] = 1
            inputs = {"input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)}
            accepted = {item.name for item in self.session.get_inputs()}
            encoded = self.session.run(None, {key: value for key, value in inputs.items() if key in accepted})[0]
            if encoded.shape != (len(batch), length, CONFIG["dimensions"]):
                raise ValueError("Unexpected ONNX output shape")
            mean = (encoded * mask[..., None]).sum(axis=1) / mask.sum(axis=1)[:, None]
            vectors = normalized(mean)
            for i, vector in enumerate(vectors, offset):
                pooled[owners[i]] += vector * weights[i]
                counts[owners[i]] += 1
        return normalized(pooled), counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, help="Optional pilot limit; omitted means all missing/stale documents")
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()
    if (args.limit is not None and args.limit < 1) or not 1 <= args.threads <= 8:
        parser.error("limit must be positive; threads must be 1..8")
    load_dotenv(ROOT / ".env")
    identity = (CONFIG["model"], CONFIG["revision"], CONFIG["recipe"])
    with db_connect() as conn:
        rows = conn.execute("""WITH docs AS (
            SELECT problem_id,'editorial' AS kind,content_hash,body AS text FROM problem_editorial WHERE status='ready'
            UNION ALL
            SELECT problem_id,'statement',content_hash,
              trim(description)||E'\\nInput:\\n'||trim(input_format)||E'\\nOutput:\\n'||trim(output_format)
              FROM problem_statement WHERE length(trim(description))>0
            ), recent AS (SELECT DISTINCT problem_id FROM (
              SELECT problem_id,row_number() OVER(PARTITION BY user_id ORDER BY solved_at DESC,problem_id) AS n
              FROM (SELECT user_id,problem_id,max(submitted_at) AS solved_at FROM submission
                    WHERE verdict='OK' GROUP BY user_id,problem_id) history) ranked WHERE n<=30)
            SELECT d.problem_id,d.kind,d.content_hash,d.text FROM docs d
            WHERE NOT EXISTS(SELECT 1 FROM retrieval_embedding e WHERE e.problem_id=d.problem_id
              AND e.source_kind=d.kind AND e.content_hash=d.content_hash AND e.model=%s AND e.model_revision=%s AND e.recipe=%s)
            ORDER BY CASE WHEN d.problem_id IN(SELECT problem_id FROM recent) THEN 0 ELSE 1 END,
                     d.problem_id,d.kind LIMIT %s""", (*identity, args.limit)).fetchall()
    print(f"Pending documents in this run: {len(rows)}", flush=True)
    if not rows:
        return
    encoder = Encoder(args.threads)
    started = time.perf_counter()
    completed = 0
    # Commit bounded batches. The database itself is the resume checkpoint.
    with db_connect() as conn:
        for offset in range(0, len(rows), 32):
            batch = rows[offset:offset+32]
            vectors, counts = encoder.encode([row[3] for row in batch])
            for row, vector, count in zip(batch, vectors, counts):
                pid, kind, content_hash, text = row
                conn.execute("""INSERT INTO retrieval_embedding
                    (problem_id,source_kind,model,model_revision,recipe,content_hash,input_hash,embedding,chunk_count)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT(problem_id,source_kind,model,model_revision,recipe) DO UPDATE SET
                    content_hash=EXCLUDED.content_hash,input_hash=EXCLUDED.input_hash,embedding=EXCLUDED.embedding,
                    chunk_count=EXCLUDED.chunk_count,created_at=now()""",
                    (pid, kind, *identity, content_hash, text_hash(text), vector.tolist(), count))
            conn.commit()
            completed += len(batch)
            print(f"Embedded {completed}/{len(rows)} documents in {time.perf_counter()-started:.1f}s", flush=True)
        coverage = conn.execute("SELECT source_kind,count(*) FROM retrieval_current_embedding "
                                "WHERE model=%s AND model_revision=%s AND recipe=%s GROUP BY source_kind", identity).fetchall()
    summary = dict(model=CONFIG, documents_processed=completed, seconds=round(time.perf_counter()-started, 2),
                   current_embeddings=dict(coverage),
                   packages={name: importlib.metadata.version(name) for name in ["onnxruntime", "tokenizers", "numpy"]})
    atomic_json(ROOT / "reports/retrieval_embeddings.json", summary)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
