#!/usr/bin/env bash
# Review an open PR with Claude and post the report as a PR comment.
#
# Runs entirely on local logins — the `claude` CLI login for the review and
# the `gh` CLI login for GitHub access. No API key or token is stored
# anywhere. Usable standalone for on-demand reviews, and invoked by
# scripts/pr-analysis/watch-prs.sh for automatic reviews of PRs raised
# against develop.
#
# Usage: bash scripts/pr-analysis/analyze-pr.sh <PR number|URL|branch>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
# shellcheck source=../lib/claude-pr-analysis.sh
source "$REPO_ROOT/scripts/lib/claude-pr-analysis.sh"

REPORT_DIR="$REPO_ROOT/.claude-reports"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <PR number|URL|branch>" >&2
  exit 1
fi
pr_arg="$1"

reason="$(claude_pr_analysis_check_prereqs)" || { echo "$reason" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || { echo "gh CLI not found — required to fetch the PR diff and post comments." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh CLI not logged in (run: gh auth login)" >&2; exit 1; }

pr_number="$(gh pr view "$pr_arg" --json number -q .number)"
[ -z "$pr_number" ] && { echo "Could not resolve PR: $pr_arg" >&2; exit 1; }

diff_text="$(gh pr diff "$pr_number")"
if [ -z "$diff_text" ]; then
  echo "PR #$pr_number has no diff — nothing to analyze." >&2
  exit 1
fi

# Give Claude's Read/Grep/Glob access only to a clean export of the PR's
# tracked files (its head commit), never the real working tree. Read ignores
# .gitignore, so the real tree could expose local secrets (e.g. .env) to a
# report that gets posted publicly on the PR — an export of tracked files at
# the PR head can't contain those, since they were never committed.
analysis_dir="$(mktemp -d)"
trap 'rm -rf "$analysis_dir"' EXIT

head_sha=""
if git -C "$REPO_ROOT" fetch origin "pull/${pr_number}/head" --quiet 2>/dev/null; then
  head_sha="$(git -C "$REPO_ROOT" rev-parse FETCH_HEAD)"
  git -C "$REPO_ROOT" archive "$head_sha" | tar -x -C "$analysis_dir"
else
  echo "Warning: could not fetch PR #$pr_number's head ref — analysis will be diff-only (no repo exploration)." >&2
fi

# Contributor lookups run against $REPO_ROOT (full git history), never
# $analysis_dir (a git-archive export with no .git dir at all). They only
# read commit metadata (author/date) and GitHub's own commit-author API data,
# never file contents — see the security notes on
# _claude_pr_analysis_pr_authors and _claude_pr_analysis_file_contributors.
pr_authors="$(_claude_pr_analysis_pr_authors "$pr_number")"

changed_files="$(printf '%s\n' "$diff_text" | grep -E '^\+\+\+ b/' | sed -E 's#^\+\+\+ b/##' | sort -u)"
file_contributors=""
if [ -n "$head_sha" ]; then
  # Walk history up to the merge-base with the PR's target branch, NOT the
  # PR's own head sha — otherwise this PR's own commits get counted into the
  # "before this PR" ranking, which is circular and can bury a first-time
  # contributor's change behind their own higher-frequency co-committers.
  # Falls back to head_sha (slightly-off, but non-fatal) if the base ref
  # can't be resolved or fetched.
  base_ref="$(gh pr view "$pr_number" --json baseRefName -q .baseRefName 2>/dev/null || true)"
  history_ref="$head_sha"
  if [ -n "$base_ref" ] && git -C "$REPO_ROOT" fetch origin "$base_ref" --quiet 2>/dev/null; then
    merge_base_sha="$(git -C "$REPO_ROOT" merge-base "$head_sha" "origin/$base_ref" 2>/dev/null || true)"
    [ -n "$merge_base_sha" ] && history_ref="$merge_base_sha"
  fi
  file_contributors="$(_claude_pr_analysis_file_contributors "$REPO_ROOT" "$history_ref" "$changed_files")"
fi

contributors_context="Authors of the commits in this PR: ${pr_authors:-unknown}

Contributors before this PR, per changed file (top 3 by commit frequency, ties broken by recency):
${file_contributors:-(unavailable for this analysis)}"

mkdir -p "$REPORT_DIR"
report_file="$REPORT_DIR/pr-${pr_number}.md"

echo "Analyzing PR #$pr_number..."
if output="$(claude_pr_analysis_run "$diff_text" "PR #$pr_number" "$analysis_dir" "$contributors_context")"; then
  status=0
else
  status=$?
fi

if [ $status -ne 0 ] || [ -z "$output" ]; then
  echo "Claude analysis failed: $output" >&2
  exit 1
fi

# The HTML-comment marker is invisible on GitHub but lets watch-prs.sh (on
# any machine) detect that this head sha was already reviewed — it is the
# cross-machine dedupe key, so keep its format in sync with the watcher.
marker="<!-- claude-pr-review: ${head_sha:-unknown} -->"
disclaimer="> 🤖 **AI-generated code review** — produced by Claude. Treat it as a starting point for review, not a substitute for one."

printf '%s\n%s\n\n%s\n' "$marker" "$disclaimer" "$output" > "$report_file"
echo "Report saved to $report_file"

gh pr comment "$pr_number" --body-file "$report_file"
echo "Posted to PR #$pr_number"
