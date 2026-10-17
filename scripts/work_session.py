"""Hold an OS-backed exclusive work lock until Enter/EOF, or wrap a command.

Automation: start this in a retained terminal session, wait for LOCK ACQUIRED,
keep the session alive while working, then send a newline when finished.
If it exits 75, a live process already owns the lock. OS releases locks on exit.
Usage: python scripts/work_session.py [-- command arguments...]
"""
import os
import subprocess
import sys
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    lockfile = root / ".git" / "datasetmedic-work.lock"
    with lockfile.open("a+b") as stream:
        stream.seek(0)
        if not stream.read(1):
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (OSError, BlockingIOError):
            print("BUSY: another live session holds the work lock.", flush=True)
            return 75
        print("LOCK ACQUIRED. Keep this process alive; send Enter to release.", flush=True)
        try:
            if len(sys.argv) > 2 and sys.argv[1] == "--":
                return subprocess.run(sys.argv[2:], cwd=root, check=False).returncode
            sys.stdin.readline()
        except KeyboardInterrupt:
            pass
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
