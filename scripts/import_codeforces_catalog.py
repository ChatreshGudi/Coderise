from __future__ import annotations

import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

API_ROOT = "https://codeforces.com/api/"
USER_AGENT = "Coderise/0.1 (public problem catalogue importer)"


def fetch_api(method: str) -> Any:
    request = urllib.request.Request(
        API_ROOT + method,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = response.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Codeforces API request failed for {method}: {exc}") from exc

    import json

    data = json.loads(payload)
    if data.get("status") != "OK":
        raise RuntimeError(
            f"Codeforces API returned {data.get('status')}: {data.get('comment', 'unknown error')}"
        )
    return data["result"]


def as_timestamp(seconds: int | None) -> datetime | None:
    if seconds is None:
        return None
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def db_connect() -> psycopg.Connection:
    password = os.getenv("PGPASSWORD")
    if not password:
        raise RuntimeError(
            "PGPASSWORD is missing. Copy .env.example to .env and set the local "
            "PostgreSQL credentials there."
        )
    return psycopg.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "coderise"),
        user=os.getenv("PGUSER", "postgres"),
        password=password,
        connect_timeout=10,
    )


def upsert_catalog(
    contests: list[dict[str, Any]],
    problems: list[dict[str, Any]],
    statistics: list[dict[str, Any]],
) -> tuple[int, int, int]:
    contest_by_id = {int(item["id"]): item for item in contests}
    problem_contest_ids = {
        int(problem["contestId"])
        for problem in problems
        if problem.get("contestId") is not None and problem.get("index")
    }
    stats_by_key = {
        (int(item["contestId"]), str(item["index"])): int(item.get("solvedCount", 0))
        for item in statistics
        if item.get("contestId") is not None and item.get("index")
    }

    tag_names = sorted(
        {
            str(tag_name)
            for problem in problems
            for tag_name in problem.get("tags", [])
            if tag_name
        }
    )

    with db_connect() as connection:
        with connection.cursor() as cursor:
            for contest_id in sorted(problem_contest_ids):
                item = contest_by_id.get(contest_id, {})
                cursor.execute(
                    """
                    INSERT INTO contest (
                        contest_id, name, contest_type, start_time, duration_secs
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (contest_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        contest_type = COALESCE(EXCLUDED.contest_type, contest.contest_type),
                        start_time = COALESCE(EXCLUDED.start_time, contest.start_time),
                        duration_secs = COALESCE(EXCLUDED.duration_secs, contest.duration_secs)
                    """,
                    (
                        contest_id,
                        item.get("name") or f"Codeforces contest {contest_id}",
                        item.get("type"),
                        as_timestamp(item.get("startTimeSeconds")),
                        item.get("durationSeconds"),
                    ),
                )

            tag_ids: dict[str, int] = {}
            for name in tag_names:
                cursor.execute(
                    """
                    INSERT INTO tag (name)
                    VALUES (%s)
                    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                    RETURNING tag_id
                    """,
                    (name,),
                )
                tag_ids[name] = cursor.fetchone()[0]

            imported_problems = 0
            imported_links = 0
            for item in problems:
                contest_id = item.get("contestId")
                problem_index = item.get("index")
                if contest_id is None or not problem_index:
                    continue

                contest_id = int(contest_id)
                problem_index = str(problem_index)
                cursor.execute(
                    """
                    INSERT INTO problem (
                        contest_id, problem_index, name, rating, solved_count
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (contest_id, problem_index) DO UPDATE SET
                        name = EXCLUDED.name,
                        rating = EXCLUDED.rating,
                        solved_count = EXCLUDED.solved_count
                    RETURNING problem_id
                    """,
                    (
                        contest_id,
                        problem_index,
                        item.get("name") or problem_index,
                        item.get("rating"),
                        stats_by_key.get((contest_id, problem_index), 0),
                    ),
                )
                problem_id = cursor.fetchone()[0]
                imported_problems += 1

                cursor.execute(
                    "DELETE FROM problem_tag WHERE problem_id = %s",
                    (problem_id,),
                )
                names = sorted(
                    {
                        str(name)
                        for name in item.get("tags", [])
                        if name and str(name) in tag_ids
                    }
                )
                if names:
                    cursor.executemany(
                        """
                        INSERT INTO problem_tag (problem_id, tag_id)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        [(problem_id, tag_ids[name]) for name in names],
                    )
                    imported_links += len(names)

    return len(problem_contest_ids), imported_problems, imported_links


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    load_dotenv(project_root / ".env")

    try:
        print("Fetching contest metadata from Codeforces...")
        contests = fetch_api("contest.list")
        print("Waiting 2.1 seconds to respect the public API request interval...")
        time.sleep(2.1)
        print("Fetching the public problem catalogue...")
        catalog = fetch_api("problemset.problems")

        imported = upsert_catalog(
            contests,
            catalog.get("problems", []),
            catalog.get("problemStatistics", []),
        )
    except (RuntimeError, psycopg.Error, OSError, ValueError) as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1

    print(
        "Catalogue sync complete: "
        f"{imported[0]} contests, {imported[1]} problems, "
        f"{imported[2]} problem-tag links processed."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())