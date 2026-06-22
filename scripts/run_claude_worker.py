#!/usr/bin/env python3
"""Run Claude CLI as an auditable Superpowers Pro worker.

The script is intentionally small: it writes the exact prompt, executes Claude
in print mode, and stores stdout/stderr/exit-code/diff/result artifacts under
.ai/workers/<run_id>.* so a later handoff can verify what happened.
"""

from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import shutil
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKERS_DIR = ROOT / ".ai" / "workers"


def run(command: list[str], *, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        input=input_text,
        text=True,
        capture_output=True,
        check=False,
    )


def make_run_id(role: str) -> str:
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
    safe_role = "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in role).strip("-")
    return f"{stamp}-{safe_role or 'worker'}"


def write(path: pathlib.Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--role", required=True, help="Worker role, e.g. audit_worker or test_worker")
    parser.add_argument("--prompt-file", required=True, help="Markdown prompt file to send to Claude")
    parser.add_argument("--model", default="sonnet", help="Claude model alias/name")
    parser.add_argument("--max-budget-usd", default="1.00", help="Claude CLI print-mode budget cap")
    parser.add_argument("--effort", default="medium", choices=["low", "medium", "high", "xhigh", "max"])
    args = parser.parse_args()

    prompt_path = pathlib.Path(args.prompt_file)
    if not prompt_path.is_absolute():
        prompt_path = ROOT / prompt_path
    if not prompt_path.exists():
        print(f"Prompt file not found: {prompt_path}", file=sys.stderr)
        return 2

    claude = shutil.which("claude")
    if not claude:
        print("Claude CLI not found on PATH", file=sys.stderr)
        return 127

    prompt = prompt_path.read_text(encoding="utf-8")
    run_id = make_run_id(args.role)

    prompt_artifact = WORKERS_DIR / f"{run_id}.prompt.md"
    stdout_artifact = WORKERS_DIR / f"{run_id}.stdout.log"
    stderr_artifact = WORKERS_DIR / f"{run_id}.stderr.log"
    exit_artifact = WORKERS_DIR / f"{run_id}.exit-code.txt"
    diff_artifact = WORKERS_DIR / f"{run_id}.diff.patch"
    result_artifact = WORKERS_DIR / f"{run_id}.result.md"

    write(prompt_artifact, prompt)

    command = [
        claude,
        "--print",
        "--model",
        args.model,
        "--effort",
        args.effort,
        "--max-budget-usd",
        args.max_budget_usd,
        prompt,
    ]
    completed = run(command)
    write(stdout_artifact, completed.stdout)
    write(stderr_artifact, completed.stderr)
    write(exit_artifact, f"{completed.returncode}\n")

    diff = run(["git", "diff", "--binary"]).stdout
    write(diff_artifact, diff)

    status = "PASS" if completed.returncode == 0 else "FAIL"
    summary = [
        f"# Claude Worker Result: {run_id}",
        "",
        f"- role: `{args.role}`",
        f"- status: `{status}`",
        f"- exit_code: `{completed.returncode}`",
        f"- prompt: `{prompt_artifact.relative_to(ROOT)}`",
        f"- stdout: `{stdout_artifact.relative_to(ROOT)}`",
        f"- stderr: `{stderr_artifact.relative_to(ROOT)}`",
        f"- diff: `{diff_artifact.relative_to(ROOT)}`",
        "",
        "## Worker stdout excerpt",
        "",
        "```text",
        completed.stdout[-4000:],
        "```",
        "",
        "## Worker stderr excerpt",
        "",
        "```text",
        completed.stderr[-2000:],
        "```",
        "",
    ]
    write(result_artifact, "\n".join(summary))
    print(result_artifact.relative_to(ROOT))
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
