"""Audit/import editorial columns from the same pinned source as our statements."""
import argparse
import collections
import json

from dotenv import load_dotenv

from import_codeforces_catalog import db_connect
from retrieval_common import (ROOT, DATASET, DATASET_REVISION, SOURCE_URL, atomic_json,
                              editorial_status, editorial_text, source_key, text_hash)


def read_source(revision, folder):
    # A completed cache is reusable offline; partial remote reads never become a cache.
    cache = folder / (revision + ".json")
    if cache.exists():
        value = json.loads(cache.read_text())
        if value["revision"] == revision:
            return value["rows"]
    import pyarrow.parquet as pq
    from huggingface_hub import HfApi, HfFileSystem
    api = HfApi()
    resolved = api.dataset_info(DATASET, revision=revision).sha
    if resolved != revision:
        raise ValueError("Pass an immutable full dataset revision, not a branch/tag")
    files = sorted(name for name in api.list_repo_files(DATASET, repo_type="dataset", revision=resolved)
                   if name.startswith("data/") and name.endswith(".parquet"))
    if not files:
        raise RuntimeError("Pinned dataset has no default Parquet files")
    rows = []
    fs = HfFileSystem()
    for number, name in enumerate(files, 1):
        print(f"Reading editorial columns {number}/{len(files)}: {name}", flush=True)
        with fs.open(f"datasets/{DATASET}@{resolved}/{name}", "rb", block_size=1024 * 1024) as stream:
            for batch in pq.ParquetFile(stream).iter_batches(batch_size=256, columns=["id", "aliases", "editorial"]):
                rows.extend(batch.to_pylist())
    atomic_json(cache, {"revision": resolved, "files": files, "rows": rows})
    return rows


def match_rows(rows, catalogue, statements, revision):
    by_source = collections.defaultdict(list)
    for pid, source_id, source_revision in statements:
        if source_revision == revision:
            by_source[source_id].append(pid)
    matched = {}
    for row in rows:
        source_id = str(row["id"])
        keys = [(source_key(source_id), 1)] + [(source_key(alias), 2) for alias in row.get("aliases") or []]
        candidates = [(pid, 0) for pid in by_source.get(source_id, [])]
        candidates.extend((catalogue[key], priority) for key, priority in keys if key in catalogue)
        for pid, priority in candidates:
            selection = (priority, source_id)
            if pid not in matched or selection < matched[pid][0]:
                matched[pid] = (selection, row)
    return {pid: row for pid, (_, row) in matched.items()}


def prepare(matched):
    planned = {}
    hashes = collections.defaultdict(set)
    for pid, row in matched.items():
        body = editorial_text(row.get("editorial"))
        if not body:
            continue
        status, reason = editorial_status(body)
        value = dict(body=body, content_hash=text_hash(body), source_problem_id=str(row["id"]),
                     status=status, review_reason=reason)
        planned[pid] = value
        hashes[value["content_hash"]].add(value["source_problem_id"])
    for value in planned.values():
        # Canonical ID + its aliases may legitimately share an editorial. Distinct
        # canonical IDs sharing the exact text require review before embedding.
        if len(hashes[value["content_hash"]]) > 1:
            value.update(status="needs_review", review_reason="shared_across_canonical_problems")
    return planned


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", default=DATASET_REVISION)
    parser.add_argument("--apply", action="store_true", help="Default is an audit with no database writes")
    args = parser.parse_args()
    folder = ROOT / "reports/editorial_import"
    rows = read_source(args.revision, folder)
    load_dotenv(ROOT / ".env")
    with db_connect() as conn:
        catalogue = {(contest, index): pid for pid, contest, index in conn.execute(
            "SELECT problem_id,contest_id,problem_index FROM problem")}
        statements = conn.execute("SELECT problem_id,source_problem_id,source_revision FROM problem_statement").fetchall()
        matched = match_rows(rows, catalogue, statements, args.revision)
        planned = prepare(matched)
        summary = dict(dataset=DATASET, revision=args.revision, applied=args.apply,
                       dataset_rows=len(rows), catalogue_problems=len(catalogue), matched_problems=len(matched),
                       with_editorial=len(planned), ready=sum(v["status"] == "ready" for v in planned.values()),
                       needs_review=sum(v["status"] != "ready" for v in planned.values()),
                       without_editorial=len(catalogue)-len(planned),
                       review_reasons=dict(collections.Counter(v["review_reason"] for v in planned.values() if v["review_reason"])))
        if args.apply:
            for pid, value in planned.items():
                conn.execute("""INSERT INTO problem_editorial
                    (problem_id,body,content_hash,source_url,source_problem_id,source_revision,status,review_reason)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(problem_id) DO UPDATE SET
                    body=EXCLUDED.body,content_hash=EXCLUDED.content_hash,source_url=EXCLUDED.source_url,
                    source_problem_id=EXCLUDED.source_problem_id,source_revision=EXCLUDED.source_revision,
                    status=EXCLUDED.status,review_reason=EXCLUDED.review_reason,imported_at=now()
                    WHERE problem_editorial.source_url=EXCLUDED.source_url""",
                    (pid, value["body"], value["content_hash"], SOURCE_URL, value["source_problem_id"],
                     args.revision, value["status"], value["review_reason"]))
            missing = list(set(matched)-set(planned))
            conn.execute("DELETE FROM problem_editorial WHERE source_url=%s AND problem_id=ANY(%s)", (SOURCE_URL, missing))
            cursor = conn.execute('SELECT * FROM retrieval_coverage')
            summary['database_coverage'] = dict(zip([column.name for column in cursor.description], cursor.fetchone()))
    # Mark an import applied only after its database transaction has committed.
    atomic_json(folder / "coverage.json", summary)
    atomic_json(folder / "review.json", [{"problem_id": pid, **value} for pid, value in planned.items()
                                         if value["status"] != "ready"])
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
