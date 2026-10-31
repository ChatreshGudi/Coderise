"""Import statement fields only from a pinned public Open R1 dataset snapshot."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

import pyarrow.parquet as pq
from dotenv import load_dotenv
from huggingface_hub import HfApi, HfFileSystem
from psycopg.types.json import Jsonb

from import_codeforces_catalog import db_connect

ROOT = Path(__file__).resolve().parents[1]
DATASET = "open-r1/codeforces"
DEFAULT_REVISION = "fbe3f6e903ee854eec2e69e9d96d0306cde59baf"
COLUMNS = ["id", "aliases", "contest_id", "index", "description", "input_format", "output_format", "note", "examples"]


def usable_description(value):
    text = (value or "").strip()
    lowered = text.lower()
    return (any(char.isalnum() for char in text)
            and lowered != "view the statement as a pdf."
            and not lowered.startswith("see the problem statement here:"))


def key_from_id(value):
    try:
        contest, index = str(value).split("/", 1)
        return int(contest), index
    except (ValueError, TypeError):
        return None


def read_statements(revision):
    api = HfApi()
    resolved = api.dataset_info(DATASET, revision=revision).sha
    files = sorted(name for name in api.list_repo_files(DATASET, repo_type="dataset", revision=resolved)
                   if name.startswith("data/") and name.endswith(".parquet"))
    if not files:
        raise RuntimeError("No dataset Parquet files found.")
    fs = HfFileSystem()
    for number, name in enumerate(files, 1):
        print(f"Reading statement columns: {name} ({number}/{len(files)})...", flush=True)
        with fs.open(f"datasets/{DATASET}@{resolved}/{name}", "rb", block_size=1024 * 1024) as source:
            parquet = pq.ParquetFile(source)
            for batch in parquet.iter_batches(batch_size=256, columns=COLUMNS):
                yield resolved, batch.to_pylist()


def run(revision):
    load_dotenv(ROOT / ".env")
    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT problem_id, contest_id, problem_index FROM problem")
            catalogue = {(contest, index): pid for pid, contest, index in cursor.fetchall()}
        if not catalogue:
            raise RuntimeError("Import the Codeforces catalogue first.")
        matched = {}
        dataset_rows = 0
        empty = 0
        unusable_ids = set()
        resolved = None
        for resolved, rows in read_statements(revision):
            for row in rows:
                dataset_rows += 1
                if not usable_description(row.get("description")):
                    empty += 1
                    unusable_ids.add(str(row["id"]))
                    continue
                canonical = key_from_id(row["id"])
                if canonical is None:
                    canonical = (int(row["contest_id"]), row["index"])
                keys = [(canonical, 0)] + [(key_from_id(alias), 1) for alias in (row.get("aliases") or [])]
                for key, priority in keys:
                    if key not in catalogue:
                        continue
                    pid = catalogue[key]
                    candidate = (priority, str(row["id"]), row)
                    if pid not in matched or candidate[:2] < matched[pid][:2]:
                        matched[pid] = candidate
        if not matched:
            raise RuntimeError("No statements matched the catalogue; no data was changed.")
        changed = 0
        alias_matches = 0
        removed_placeholders = []
        with connection.cursor() as cursor:
            if unusable_ids:
                cursor.execute("DELETE FROM problem_statement WHERE source_url=%s AND source_problem_id=ANY(%s) RETURNING problem_id",
                               (f"https://huggingface.co/datasets/{DATASET}", sorted(unusable_ids)))
                removed_placeholders = cursor.fetchall()
                if removed_placeholders:
                    cursor.executemany("DELETE FROM problem_embedding WHERE problem_id=%s", removed_placeholders)
            for pid, (priority, source_id, row) in sorted(matched.items()):
                fields = {name: row.get(name) or ([] if name == "examples" else "")
                          for name in ["description", "input_format", "output_format", "note", "examples"]}
                digest = hashlib.sha256(json.dumps(fields, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
                cursor.execute("SELECT content_hash FROM problem_statement WHERE problem_id = %s", (pid,))
                previous = cursor.fetchone()
                text_changed = previous is None or previous[0] != digest
                cursor.execute(
                    """INSERT INTO problem_statement
                    (problem_id, description, input_format, output_format, note, examples,
                     source_url, source_revision, source_problem_id, content_hash)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (problem_id) DO UPDATE SET
                    description=EXCLUDED.description, input_format=EXCLUDED.input_format,
                    output_format=EXCLUDED.output_format, note=EXCLUDED.note,
                    examples=EXCLUDED.examples, source_url=EXCLUDED.source_url,
                    source_revision=EXCLUDED.source_revision, source_problem_id=EXCLUDED.source_problem_id,
                    content_hash=EXCLUDED.content_hash, imported_at=now()""",
                    (pid, fields["description"], fields["input_format"], fields["output_format"], fields["note"],
                     Jsonb(fields["examples"]), f"https://huggingface.co/datasets/{DATASET}", resolved, source_id, digest))
                if text_changed:
                    changed += 1
                    cursor.execute("DELETE FROM problem_embedding WHERE problem_id=%s", (pid,))
                alias_matches += priority == 1
            cursor.execute("SELECT to_regclass('public.user_embedding')")
            has_user_vectors = cursor.fetchone()[0] is not None
            if (changed or removed_placeholders) and has_user_vectors:
                cursor.execute("DELETE FROM user_embedding")
            cursor.execute("SELECT * FROM statement_coverage")
            total, covered, missing = cursor.fetchone()
            cursor.execute("""SELECT p.contest_id,p.problem_index,p.name,p.rating
                           FROM problem p LEFT JOIN problem_statement ps USING(problem_id)
                           WHERE ps.problem_id IS NULL ORDER BY p.contest_id,p.problem_index""")
            missing_rows = cursor.fetchall()
            cursor.execute("""SELECT p.contest_id,p.problem_index,p.name,length(trim(ps.description))
                           FROM problem_statement ps JOIN problem p USING(problem_id)
                           WHERE length(trim(ps.description))<80 ORDER BY p.contest_id,p.problem_index""")
            review_rows = cursor.fetchall()
        summary = dict(dataset=DATASET, revision=resolved, dataset_rows=dataset_rows,
                       unusable_dataset_rows=empty, matched_this_import=len(matched), alias_matches=alias_matches,
                       changed_statements=changed, catalogue_problems=total, with_statements=covered,
                       without_statements=missing, coverage_percent=round(covered * 100 / total, 2))
    reports = ROOT / "reports"
    reports.mkdir(exist_ok=True)
    (reports / "statement_coverage.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    with (reports / "missing_statements.csv").open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output)
        writer.writerow(["contest_id", "problem_index", "name", "rating"])
        writer.writerows(missing_rows)
    with (reports / "short_statements_review.csv").open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output)
        writer.writerow(["contest_id", "problem_index", "name", "description_characters"])
        writer.writerows(review_rows)
    print(json.dumps(summary, indent=2))
    print("Local coverage reports: reports/statement_coverage.json and reports/missing_statements.csv")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", default=DEFAULT_REVISION, help="Dataset revision (default: pinned snapshot).")
    args = parser.parse_args()
    try:
        run(args.revision)
    except Exception as exc:
        print(f"Statement import failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
