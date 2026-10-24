"""Publish job summaries atomically and read only selected finding records."""
import json
from pathlib import Path

from datasetmedic.engine import safe


def write_result(folder: Path, result: dict):
    header = {key: value for key, value in result.items() if key != "findings"}
    if "findings" in result:
        index = []
        with (folder / "findings.tmp").open("wb") as stream:
            for finding in result["findings"]:
                record = (json.dumps(safe(finding), ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")
                index.append({**{key: finding.get(key, []) if key == "columns" else finding[key]
                                 for key in ("title", "detail", "columns", "severity")},
                              "offset": stream.tell(), "length": len(record)})
                stream.write(record)
        (folder / "findings.tmp").replace(folder / "findings.jsonl")
        (folder / "index.tmp").write_text(json.dumps(safe(index), ensure_ascii=False), encoding="utf-8")
        (folder / "index.tmp").replace(folder / "findings-index.json")
        header["finding_count"] = len(index)
    (folder / "result.tmp").write_text(json.dumps(safe(header), allow_nan=False), encoding="utf-8")
    # This completion marker is published only after the index and all records exist.
    (folder / "result.tmp").replace(folder / "result.json")


def read_findings(folder: Path, result: dict, offset: int, limit: int, query: str, severity: str):
    legacy = "findings" in result
    if legacy:
        index = result["findings"]
    elif "finding_count" in result:
        index = json.loads((folder / "findings-index.json").read_text(encoding="utf-8"))
    else:
        return {"total": 0, "items": []}
    needle = query.strip().casefold()
    matches = [finding for finding in index if (severity == "all" or finding["severity"] == severity)
               and (not needle or needle in " ".join([finding["title"], finding["detail"],
                                                      *finding.get("columns", [])]).casefold())]
    selected = matches[max(0, offset):max(0, offset) + min(100, max(1, limit))]
    if legacy:
        return {"total": len(matches), "items": selected}
    items = []
    if selected:
        with (folder / "findings.jsonl").open("rb") as stream:
            for entry in selected:
                stream.seek(entry["offset"])
                items.append(json.loads(stream.read(entry["length"])))
    return {"total": len(matches), "items": items}
