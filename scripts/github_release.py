"""Publish project metadata/release assets with credentials kept only in memory.

Uses the existing Git credential helper. Does not trigger sign-in or print tokens.
Usage: python scripts/github_release.py --configure | --publish | --status
"""
import argparse
import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = "Aadithya-Ram/DatasetMedic"
ROOT = Path(__file__).resolve().parents[1]


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected and urllib.parse.urlparse(req.full_url).netloc != urllib.parse.urlparse(newurl).netloc:
            redirected.remove_header("Authorization")
        return redirected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--configure", action="store_true")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--logs", type=int, help="Read a GitHub Actions job's final log lines")
    args = parser.parse_args()
    credentials = subprocess.run(["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\nusername=Aadithya-Ram\n\n", text=True, capture_output=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GCM_INTERACTIVE": "never"}, check=False)
    fields = dict(line.split("=", 1) for line in credentials.stdout.splitlines() if "=" in line)
    if not fields.get("password"):
        raise SystemExit("GitHub sign-in is required. No changes were published.")
    headers = {"Authorization": "Bearer " + fields["password"], "Accept": "application/vnd.github+json",
               "User-Agent": "DatasetMedic-release", "X-GitHub-Api-Version": "2022-11-28"}

    def api(path, method="GET", data=None, binary=None, content_type=None, raw=False):
        url = path if path.startswith("https://") else "https://api.github.com" + path
        payload = binary if binary is not None else json.dumps(data).encode() if data is not None else None
        request_headers = {**headers, "Content-Type": content_type or "application/json"}
        req = urllib.request.Request(url, headers=request_headers, method=method, data=payload)
        try:
            with urllib.request.build_opener(SafeRedirect()).open(req, timeout=60) as response:
                body = response.read()
                return body.decode("utf-8", errors="replace") if raw else json.loads(body) if body else None
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            raise SystemExit(f"GitHub rejected {method} (HTTP {exc.code}). No credential details logged.") from None

    account = api("/user")
    if account["login"].lower() != "aadithya-ram":
        raise SystemExit("The authenticated GitHub account does not match the repository owner.")
    if args.logs:
        logs = api(f"/repos/{REPO}/actions/jobs/{args.logs}/logs", raw=True)
        print("\n".join((logs or "No logs available.").splitlines()[-90:]))
    if args.status:
        runs = api(f"/repos/{REPO}/actions/runs?per_page=3")
        for run in (runs or {}).get("workflow_runs", []):
            print(run["id"], run["head_sha"][:10], run["status"], run["conclusion"], run["html_url"])
            jobs = api(f"/repos/{REPO}/actions/runs/{run['id']}/jobs")
            for job in (jobs or {}).get("jobs", []):
                failures = [s["name"] for s in job.get("steps", []) if s.get("conclusion") == "failure"]
                print(" ", job["id"], job["name"], job["status"], job["conclusion"], ", ".join(failures))
    if args.configure:
        email = f"{account['id']}+{account['login']}@users.noreply.github.com"
        subprocess.run(["git", "config", "--local", "user.email", email], cwd=ROOT, check=True)
        api(f"/repos/{REPO}", "PATCH", {"description": "Inspect datasets before you train. Local data auditing, split leakage evidence, and reproducible cleaning.", "has_wiki": False})
        api(f"/repos/{REPO}/topics", "PUT", {"names": ["machine-learning", "data-quality", "data-cleaning", "data-leakage", "polars", "fastapi", "react", "local-first", "python", "open-source"]})
        print("Repository description/topics configured; local Git author uses account-linked no-reply email.")
    if args.publish:
        tag = "v0.1.0"
        release = api(f"/repos/{REPO}/releases/tags/{tag}")
        if not release:
            release = api(f"/repos/{REPO}/releases", "POST", {
                "tag_name": tag, "target_commitish": "main", "name": "DatasetMedic 0.1.0 — A little clarity before you train",
                "body": (ROOT / "docs" / "release-notes.md").read_text(encoding="utf-8"),
                "draft": False, "prerelease": False})
        names = {a["name"] for a in release["assets"]}
        for path in sorted((ROOT / "dist").iterdir()):
            if path.name in names or not (path.name.endswith((".whl", ".tar.gz")) or path.name == "SHA256SUMS.txt"):
                continue
            url = release["upload_url"].split("{")[0] + "?name=" + urllib.parse.quote(path.name)
            api(url, "POST", binary=path.read_bytes(), content_type="application/octet-stream")
            print("Uploaded release asset:", path.name)
        print("Release:", release["html_url"])


if __name__ == "__main__":
    main()
