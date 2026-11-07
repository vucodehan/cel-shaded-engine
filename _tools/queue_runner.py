"""Sequential film queue: python queue_runner.py [--after=PID] [--no-drp]

Reads _state/queue.txt (one job per line). A job is a film folder (full pipeline, then the Resolve project) or
"drp:<folder>" (Resolve project only). Finished jobs are appended to _state/queue_done.txt; failures to
queue_failed.txt. Waits for new jobs until _state/queue.stop exists. Films run one at a time; inside a film the
pipeline renders its parts in parallel (config.json render.parallel).
--no-drp skips the Resolve step of film jobs (for when Resolve is busy with other work); queue "drp:<folder>"
lines later to build those projects.
"""
import os
import subprocess
import sys
import time
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
SERIES = TOOLS.parent / "_state"
Q, DONE, FAIL, STOP = SERIES / "queue.txt", SERIES / "queue_done.txt", SERIES / "queue_failed.txt", SERIES / "queue.stop"


def lines(p):
    return [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] if p.exists() else []


def pid_alive(pid: int) -> bool:
    out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True).stdout
    return str(pid) in out


def run(job: str, conc: str, drp: bool = True) -> bool:
    py = sys.executable
    if job.startswith("drp:"):
        steps = [[py, str(TOOLS / "resolve_drp.py"), job[4:]]]
    else:
        # with a Resolve step the masters must survive until resolve_drp.py has used them; then the clean-up
        steps = [[py, str(TOOLS / "pipeline.py"), job] + (["--keep-masters"] if drp else [])]
        if drp:
            steps += [[py, str(TOOLS / "resolve_drp.py"), job], [py, str(TOOLS / "cleanup.py"), job]]
    for cmd in steps:
        print(time.strftime("%H:%M:%S"), ">", " ".join(cmd[1:]), flush=True)
        r = subprocess.run(cmd, cwd=str(TOOLS))
        if r.returncode != 0:
            print("FAILED", job, r.returncode, flush=True)
            return False
    return True


def main():
    args = sys.argv[1:]
    after = next((int(a.split("=")[1]) for a in args if a.startswith("--after=")), None)
    after_deliver = next((a.split("=")[1] for a in args if a.startswith("--after-deliver=")), None)
    conc = next((a.split("=")[1] for a in args if a.startswith("--concurrency=")), "20")
    drp = "--no-drp" not in args
    if after:
        while pid_alive(after):
            time.sleep(20)
    if after_deliver:
        import json

        log = SERIES / "runlog.json"
        while True:
            data = json.loads(log.read_text(encoding="utf-8")) if log.exists() else {}
            if data.get(after_deliver, {}).get("deliver", {}).get("end"):
                break
            time.sleep(20)
    while True:
        done = set(lines(DONE)) | set(lines(FAIL))
        pending = [j for j in lines(Q) if j not in done]
        if pending:
            job = pending[0]
            ok = run(job, conc, drp)
            with open(DONE if ok else FAIL, "a", encoding="utf-8") as fh:
                fh.write(job + "\n")
            continue
        if STOP.exists():
            break
        time.sleep(30)
    print("queue finished", flush=True)


if __name__ == "__main__":
    main()
