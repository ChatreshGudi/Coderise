from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

API_ROOT = "https://codeforces.com/api/"
USER_AGENT = "Coderise/0.1 (public profile importer)"
SUBMISSION_LIMIT = 2000
PENDING_VERDICTS = {"TESTING", "SUBMITTED"}
KNOWN_VERDICTS = {
    "FAILED",
    "OK",
    "PARTIAL",
    "COMPILATION_ERROR",
    "RUNTIME_ERROR",
    "WRONG_ANSWER",
    "TIME_LIMIT_EXCEEDED",
    "MEMORY_LIMIT_EXCEEDED",
    "IDLENESS_LIMIT_EXCEEDED",
    "SECURITY_VIOLATED",
    "CRASHED",
    "INPUT_PREPARATION_CRASHED",
    "CHALLENGED",
    "SKIPPED",
    "TESTING",
    "REJECTED",
    "SUBMITTED",
}


def fetch_api(method: str, params: dict[str, str]) -> Any:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{API_ROOT}{method}?{query}",
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
            f"Codeforces API returned {data.get('status')}: "
            f"{data.get('comment', 'unknown error')}"
        )
    return data["result"]


def wait_for_api_interval() -> None:
    time.sleep(2.1)


def as_timestamp(seconds: int | None) -> datetime | None:
    if seconds is None:
        return None
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def connect_db() -> psycopg.Connection:
    password = os.getenv("PGPASSWORD")
    if not password:
        raise RuntimeError(
            "PGPASSWORD is missing. Set the local PostgreSQL credentials in .env."
        )
    return psycopg.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "coderise"),
        user=os.getenv("PGUSER", "postgres"),
        password=password,
        connect_timeout=10,
    )


def ensure_contest(cursor: psycopg.Cursor, contest_id: int, name: str | None = None) -> None:
    cursor.execute(
        """
        INSERT INTO contest (contest_id, name)
        VALUES (%s, %s)
        ON CONFLICT (contest_id) DO NOTHING
        """,
        (contest_id, name or f"Codeforces contest {contest_id}"),
    )


def ensure_problem(
    cursor: psycopg.Cursor,
    problem: dict[str, Any],
    problem_cache: dict[tuple[int, str], int],
) -> int | None:
    contest_id = problem.get("contestId")
    problem_index = problem.get("index")
    if contest_id is None or not problem_index:
        return None

    contest_id = int(contest_id)
    problem_index = str(problem_index)
    key = (contest_id, problem_index)
    if key in problem_cache:
        return problem_cache[key]

    ensure_contest(cursor, contest_id)
    cursor.execute(
        """
        INSERT INTO problem (contest_id, problem_index, name, rating)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (contest_id, problem_index) DO UPDATE SET
            name = EXCLUDED.name,
            rating = COALESCE(EXCLUDED.rating, problem.rating)
        RETURNING problem_id
        """,
        (
            contest_id,
            problem_index,
            problem.get("name") or problem_index,
            problem.get("rating"),
        ),
    )
    problem_id = cursor.fetchone()[0]
    problem_cache[key] = problem_id

    for tag_name in sorted({str(name) for name in problem.get("tags", []) if name}):
        cursor.execute(
            """
            INSERT INTO tag (name)
            VALUES (%s)
            ON CONFLICT (name) DO NOTHING
            RETURNING tag_id
            """,
            (tag_name,),
        )
        row = cursor.fetchone()
        if row is None:
            cursor.execute("SELECT tag_id FROM tag WHERE name = %s", (tag_name,))
            row = cursor.fetchone()
        tag_id = row[0]
        cursor.execute(
            """
            INSERT INTO problem_tag (problem_id, tag_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (problem_id, tag_id),
        )

    return problem_id


def import_user(
    handle: str,
    profile: dict[str, Any],
    rating_changes: list[dict[str, Any]],
    submissions: list[dict[str, Any]],
) -> tuple[int, int, int]:
    handle = profile.get("handle") or handle
    processed_ratings = 0
    processed_submissions = 0
    skipped_submissions = 0

    with connect_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app_user (
                    cf_handle, rating, max_rating, country, rank_title
                )
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (cf_handle) DO UPDATE SET
                    rating = EXCLUDED.rating,
                    max_rating = EXCLUDED.max_rating,
                    country = EXCLUDED.country,
                    rank_title = EXCLUDED.rank_title
                RETURNING user_id
                """,
                (
                    handle,
                    profile.get("rating"),
                    profile.get("maxRating"),
                    profile.get("country"),
                    profile.get("rank"),
                ),
            )
            user_id = cursor.fetchone()[0]

            for change in rating_changes:
                contest_id = int(change["contestId"])
                ensure_contest(cursor, contest_id, change.get("contestName"))
                cursor.execute(
                    """
                    INSERT INTO rating_change (
                        user_id, contest_id, old_rating, new_rating, rank_in_contest
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, contest_id) DO UPDATE SET
                        old_rating = EXCLUDED.old_rating,
                        new_rating = EXCLUDED.new_rating,
                        rank_in_contest = EXCLUDED.rank_in_contest
                    """,
                    (
                        user_id,
                        contest_id,
                        change.get("oldRating"),
                        change.get("newRating"),
                        change.get("rank"),
                    ),
                )
                processed_ratings += 1

            problem_cache: dict[tuple[int, str], int] = {}
            for item in submissions:
                problem = item.get("problem") or {}
                problem_id = ensure_problem(cursor, problem, problem_cache)
                if problem_id is None:
                    skipped_submissions += 1
                    continue

                verdict = item.get("verdict") or "TESTING"
                if verdict not in KNOWN_VERDICTS:
                    raise RuntimeError(
                        f"Unsupported Codeforces verdict {verdict!r} "
                        f"in submission {item.get('id')}"
                    )

                memory_bytes = item.get("memoryConsumedBytes")
                memory_kb = int(memory_bytes) // 1024 if memory_bytes is not None else None
                cursor.execute(
                    """
                    INSERT INTO submission (
                        submission_id, user_id, problem_id, verdict, language,
                        submitted_at, time_ms, memory_kb
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (submission_id) DO UPDATE SET
                        verdict = EXCLUDED.verdict,
                        language = COALESCE(EXCLUDED.language, submission.language),
                        time_ms = COALESCE(EXCLUDED.time_ms, submission.time_ms),
                        memory_kb = COALESCE(EXCLUDED.memory_kb, submission.memory_kb)
                    WHERE submission.verdict IN ('TESTING', 'SUBMITTED')
                      AND EXCLUDED.verdict NOT IN ('TESTING', 'SUBMITTED')
                    """,
                    (
                        int(item["id"]),
                        user_id,
                        problem_id,
                        verdict,
                        item.get("programmingLanguage"),
                        as_timestamp(item.get("creationTimeSeconds")),
                        item.get("timeConsumedMillis"),
                        memory_kb,
                    ),
                )
                processed_submissions += 1

    return processed_ratings, processed_submissions, skipped_submissions


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import a Codeforces user's public profile, rating history, and recent submissions."
    )
    parser.add_argument("handle", help="Codeforces handle to import")
    args = parser.parse_args()
    handle = args.handle.strip()
    if not handle:
        parser.error("handle cannot be empty")

    project_root = Path(__file__).resolve().parents[1]
    load_dotenv(project_root / ".env")

    try:
        print(f"Fetching Codeforces profile for {handle}...")
        profiles = fetch_api("user.info", {"handles": handle})
        if not profiles:
            raise RuntimeError(f"Codeforces returned no profile for {handle}.")
        profile = profiles[0]

        wait_for_api_interval()
        print("Fetching contest rating history...")
        rating_changes = fetch_api("user.rating", {"handle": handle})

        wait_for_api_interval()
        print(f"Fetching up to {SUBMISSION_LIMIT} recent submissions...")
        submissions = fetch_api(
            "user.status",
            {"handle": handle, "from": "1", "count": str(SUBMISSION_LIMIT)},
        )

        result = import_user(handle, profile, rating_changes, submissions)
    except (RuntimeError, psycopg.Error, OSError, ValueError, KeyError) as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1

    print(
        f"Profile sync complete for {handle}: {result[0]} rating changes, "
        f"{result[1]} submission records processed, "
        f"{result[2]} submissions skipped (problem missing contest ID or index)."
    )
    print("Public profile imported. No Codeforces credentials are requested.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())