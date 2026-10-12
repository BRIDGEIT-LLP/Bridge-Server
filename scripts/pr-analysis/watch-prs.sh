#!/usr/bin/env bash
# Watch for open PRs raised against develop and auto-review each one with
# Claude, posting the report as a PR comment — the "code review when a PR is
# raised" trigger, with no API key, no token, no CI.
#
# Runs on any dev machine with the `gh` and `claude` CLIs logged in. Leave it
# running in a Git Bash window (Ctrl+C to stop):
#
#   bash scripts/pr-analysis/watch-prs.sh
#
# Behavior:
# - Polls every POLL_INTERVAL seconds (default 180) for open, non-draft PRs
#   whose base is BASE_BRANCH (default develop).
# - Reviews a PR once per head commit: pushing new commits to an open PR
#   changes its head sha and triggers a fresh review comment.
# - Dedupe is cross-machine: analyze-pr.sh embeds an invisible
#   "<!-- claude-pr-review: <head sha> -->" marker in every posted comment,
#   and the watcher skips any PR whose current head sha already has a marker
#   comment — so restarts, multiple watchers, and manual analyze-pr.sh runs
#   never double-post. A local state file (.claude-reports/.watch-state) is
#   only a cheap first-level cache in front of that check.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
# shellcheck source=../lib/claude-pr-analysis.sh
source "$REPO_ROOT/scripts/lib/claude-pr-analysis.sh"

POLL_INTERVAL="${POLL_INTERVAL:-180}"
BASE_BRANCH="${BASE_BRANCH:-develop}"
STATE_FILE="$REPO_ROOT/.claude-reports/.watch-state"

reason="$(claude_pr_analysis_check_prereqs)" || { echo "$reason" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "gh CLI not found — required to list PRs and post comments." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh CLI not logged in (run: gh auth login)" >&2; exit 1; }

mkdir -p "$(dirname "$STATE_FILE")"
touch "$STATE_FILE"

echo "[watch-prs] watching open PRs targeting '$BASE_BRANCH' every ${POLL_INTERVAL}s — Ctrl+C to stop"

while true; do
  if ! prs="$(gh pr list --base "$BASE_BRANCH" --state open \
      --json number,headRefOid,isDraft \
      --jq '.[] | select(.isDraft | not) | "\(.number) \(.headRefOid)"' 2>&1)"; then
    echo "[watch-prs] $(date '+%H:%M:%S') could not list PRs (will retry): $prs" >&2
    sleep "$POLL_INTERVAL"
    continue
  fi

  if [ -z "$prs" ]; then
    echo "[watch-prs] $(date '+%H:%M:%S') no open PRs targeting $BASE_BRANCH"
  fi

  while IFS=' ' read -r number sha; do
    [ -z "$number" ] && continue

    # Level 1: this machine already handled this exact head sha.
    grep -qx "${number}:${sha}" "$STATE_FILE" && continue

    # Level 2: someone (another watcher, a manual analyze-pr.sh run) already
    # posted a review comment for this head sha.
    if gh pr view "$number" --json comments --jq '.comments[].body' 2>/dev/null \
        | grep -q "claude-pr-review: ${sha}"; then
      echo "[watch-prs] $(date '+%H:%M:%S') PR #$number @ ${sha:0:7} already reviewed — skipping"
      echo "${number}:${sha}" >> "$STATE_FILE"
      continue
    fi

    echo "[watch-prs] $(date '+%H:%M:%S') reviewing PR #$number @ ${sha:0:7}..."
    if bash "$SCRIPT_DIR/analyze-pr.sh" "$number"; then
      echo "${number}:${sha}" >> "$STATE_FILE"
    else
      echo "[watch-prs] review of PR #$number failed — will retry next cycle" >&2
    fi
  done <<< "$prs"

  sleep "$POLL_INTERVAL"
done
