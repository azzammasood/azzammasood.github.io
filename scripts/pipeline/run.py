"""Live portfolio pipeline: extract -> validate -> transform -> load.

Runs on a schedule in GitHub Actions (.github/workflows/pipeline.yml) and
writes status.json to the pipeline-data branch. The site reads that file for
the landing-page status card and the pipeline_runs table on /query/.

Sources
  - OpenSky Network: live aircraft state vectors over Pakistan.
  - GitHub: public activity for the portfolio owner.

A run is "success" when every source loads and every check passes,
"degraded" when a source fails or a check fails but data still loaded, and
"failed" when nothing could be loaded. Standard library only.
"""

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

PIPELINE = "flight-ingest"
HISTORY = 48
TIMEOUT = 20

# Bounding box around Pakistan (lat/lon).
BBOX = {"lamin": 23.5, "lomin": 60.8, "lamax": 37.1, "lomax": 77.8}
OPENSKY_URL = (
    "https://opensky-network.org/api/states/all"
    "?lamin={lamin}&lomin={lomin}&lamax={lamax}&lomax={lomax}".format(**BBOX)
)
GITHUB_USER = os.environ.get("PIPELINE_GITHUB_USER", "azzammasood")
GITHUB_EVENTS_URL = "https://api.github.com/users/{}/events/public?per_page=100".format(GITHUB_USER)

# OpenSky state vector field positions.
F_ICAO, F_CALLSIGN, F_COUNTRY, F_LAST_CONTACT = 0, 1, 2, 4
F_LON, F_LAT, F_BARO_ALT, F_ON_GROUND, F_VELOCITY = 5, 6, 7, 8, 9


def now():
    return datetime.now(timezone.utc)


def iso(moment):
    return moment.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch_json(url, headers=None):
    request = urllib.request.Request(url, headers={"User-Agent": "portfolio-pipeline", **(headers or {})})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


# --------------------------------------------------------------------------- extract


def extract():
    sources = {}

    started = time.monotonic()
    try:
        payload = fetch_json(OPENSKY_URL)
        states = payload.get("states") or []
        sources["opensky"] = {"ok": True, "rows": len(states), "data": payload}
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        sources["opensky"] = {"ok": False, "rows": 0, "error": str(error)[:200]}
    sources["opensky"]["ms"] = round((time.monotonic() - started) * 1000)

    started = time.monotonic()
    headers = {"Accept": "application/vnd.github+json"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    try:
        events = fetch_json(GITHUB_EVENTS_URL, headers)
        sources["github"] = {"ok": True, "rows": len(events), "data": events}
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        sources["github"] = {"ok": False, "rows": 0, "error": str(error)[:200]}
    sources["github"]["ms"] = round((time.monotonic() - started) * 1000)

    return sources


# --------------------------------------------------------------------------- validate


def validate(sources, run_started):
    checks = []

    def check(name, passed, detail):
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    flights = sources["opensky"]
    if not flights["ok"]:
        check("opensky_reachable", False, flights.get("error", "request failed"))
        return checks

    payload = flights["data"]
    states = payload.get("states") or []
    check("opensky_reachable", True, "{} state vectors".format(len(states)))
    check("row_count_positive", len(states) > 0, "{} rows".format(len(states)))

    malformed = [s for s in states if not isinstance(s, list) or len(s) < 17]
    check("schema_17_fields", not malformed, "{} malformed rows".format(len(malformed)))
    states = [s for s in states if s not in malformed]

    icao = [s[F_ICAO] for s in states]
    duplicates = len(icao) - len(set(icao))
    check("icao24_unique", duplicates == 0, "{} duplicate aircraft ids".format(duplicates))

    positioned = [s for s in states if s[F_LAT] is not None and s[F_LON] is not None]
    outside = [
        s for s in positioned
        if not (BBOX["lamin"] <= s[F_LAT] <= BBOX["lamax"] and BBOX["lomin"] <= s[F_LON] <= BBOX["lomax"])
    ]
    check("positions_in_bbox", not outside, "{} of {} outside the box".format(len(outside), len(positioned)))

    negative = [s for s in states if s[F_VELOCITY] is not None and s[F_VELOCITY] < 0]
    check("velocity_non_negative", not negative, "{} negative velocities".format(len(negative)))

    snapshot = payload.get("time")
    if snapshot:
        age = run_started.timestamp() - snapshot
        check("snapshot_fresh_15m", age <= 900, "snapshot is {}s old".format(round(age)))
    else:
        check("snapshot_fresh_15m", False, "no snapshot time")

    return checks


# --------------------------------------------------------------------------- transform


def transform(sources, run_started):
    metrics = {}

    flights = sources["opensky"]
    if flights["ok"]:
        states = [s for s in (flights["data"].get("states") or []) if isinstance(s, list) and len(s) >= 17]
        airborne = [s for s in states if not s[F_ON_GROUND]]
        altitudes = [s[F_BARO_ALT] for s in airborne if s[F_BARO_ALT] is not None]
        speeds = [s[F_VELOCITY] for s in airborne if s[F_VELOCITY] is not None]
        countries = Counter((s[F_COUNTRY] or "Unknown") for s in states)
        metrics.update({
            "aircraft": len(states),
            "airborne": len(airborne),
            "on_ground": len(states) - len(airborne),
            "countries": len(countries),
            "avg_altitude_m": round(sum(altitudes) / len(altitudes)) if altitudes else None,
            "max_speed_kmh": round(max(speeds) * 3.6) if speeds else None,
            "top_countries": [{"country": c, "count": n} for c, n in countries.most_common(5)],
        })

    activity = sources["github"]
    if activity["ok"]:
        cutoff = run_started - timedelta(days=7)
        recent = []
        for event in activity["data"]:
            try:
                created = datetime.strptime(event["created_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            except (KeyError, ValueError):
                continue
            if created >= cutoff:
                recent.append(event)
        pushes = [e for e in recent if e.get("type") == "PushEvent"]
        metrics.update({
            "github_events_7d": len(recent),
            "github_commits_7d": sum(len((e.get("payload") or {}).get("commits") or []) or 1 for e in pushes),
        })

    return metrics


# --------------------------------------------------------------------------- load


def load(path, run):
    feed = {"pipeline": PIPELINE, "runs": []}
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as handle:
                feed = json.load(handle)
        except (OSError, ValueError):
            pass

    runs = [run] + [r for r in feed.get("runs", []) if r.get("run_id") != run["run_id"]]
    feed.update({
        "pipeline": PIPELINE,
        "generated_at": run["finished_at"],
        "source": {"opensky_bbox": BBOX, "github_user": GITHUB_USER},
        "latest": run,
        "runs": runs[:HISTORY],
    })

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(feed, handle, indent=2)
        handle.write("\n")
    return feed


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="status.json", help="status file to update")
    args = parser.parse_args()

    started = now()
    clock = time.monotonic()
    stages = []

    t = time.monotonic()
    sources = extract()
    stages.append({"name": "extract", "ms": round((time.monotonic() - t) * 1000)})

    t = time.monotonic()
    checks = validate(sources, started)
    stages.append({"name": "validate", "ms": round((time.monotonic() - t) * 1000)})

    t = time.monotonic()
    metrics = transform(sources, started)
    stages.append({"name": "transform", "ms": round((time.monotonic() - t) * 1000)})

    loaded_sources = [name for name, s in sources.items() if s["ok"]]
    rows_loaded = sum(s["rows"] for s in sources.values() if s["ok"])
    if not loaded_sources:
        state = "failed"
    elif len(loaded_sources) < len(sources) or not all(c["passed"] for c in checks):
        state = "degraded"
    else:
        state = "success"

    run = {
        "run_id": os.environ.get("GITHUB_RUN_ID") or started.strftime("local-%Y%m%dT%H%M%S"),
        "started_at": iso(started),
        "status": state,
        "rows_loaded": rows_loaded,
        "sources": [
            {k: v for k, v in dict(s, name=name).items() if k != "data"} for name, s in sources.items()
        ],
        "checks": checks,
        "metrics": metrics,
    }

    run["stages"] = stages
    run["finished_at"] = iso(now())
    run["duration_ms"] = round((time.monotonic() - clock) * 1000)
    load(args.out, run)

    passed = sum(c["passed"] for c in checks)
    print("{} run {}: {} rows, {}/{} checks passed".format(PIPELINE, state, rows_loaded, passed, len(checks)))
    for source in run["sources"]:
        print("  source {}: ok={} rows={} {}ms {}".format(
            source["name"], source["ok"], source["rows"], source["ms"], source.get("error", "")))
    for c in checks:
        print("  check {}: {} ({})".format(c["name"], "pass" if c["passed"] else "FAIL", c["detail"]))


if __name__ == "__main__":
    main()
