# Shared helpers for running Claude PR-analysis prompts against a diff.
# Sourced by scripts/pr-analysis/analyze-pr.sh (full code review of a PR
# raised against develop) and scripts/pr-analysis/watch-prs.sh (the polling
# watcher that triggers those reviews) — keep the invocation plumbing here,
# don't duplicate it.
#
# Auth model: everything runs on the local `claude` CLI login and the local
# `gh` CLI login — no API key or token is stored in the repo or in CI.

CLAUDE_PR_ANALYSIS_MAX_DIFF_CHARS="${CLAUDE_PR_ANALYSIS_MAX_DIFF_CHARS:-300000}"

# Returns 0 if the claude CLI is installed and logged in. Otherwise returns
# 1 and prints a human-readable reason to stdout (caller decides where it goes).
claude_pr_analysis_check_prereqs() {
  if ! command -v claude >/dev/null 2>&1; then
    echo "claude CLI not found (npm install -g @anthropic-ai/claude-code)"
    return 1
  fi
  if ! claude auth status >/dev/null 2>&1; then
    echo "claude CLI not logged in (run: claude, and complete the login)"
    return 1
  fi
  return 0
}

# Truncates diff text to CLAUDE_PR_ANALYSIS_MAX_DIFF_CHARS and appends a note
# if truncated. Prints "<diff><note>" to stdout.
_claude_pr_analysis_prepare_diff() {
  local diff_text="$1"
  local truncated_note=""

  if [ "${#diff_text}" -gt "$CLAUDE_PR_ANALYSIS_MAX_DIFF_CHARS" ]; then
    diff_text="${diff_text:0:$CLAUDE_PR_ANALYSIS_MAX_DIFF_CHARS}"
    truncated_note=$'\n\n[diff truncated for length — analysis covers only the first part of the change]'
  fi

  printf '%s%s' "$diff_text" "$truncated_note"
}

# Args: $1 = repo root (must have full git history — the isolated,
# tracked-files-only export used for Read/Grep/Glob does NOT, since it comes
# from `git archive` and has no .git directory), $2 = git ref to walk history
# FROM — pass the merge-base with the PR's target branch, NOT the PR's own
# head sha, so this reports contributors BEFORE this PR rather than counting
# the PR's own commits into the ranking (which would be circular, and — worse
# — can bury a first-time contributor's one-line change behind veteran
# authors with hundreds of prior commits on the same file; see
# _claude_pr_analysis_pr_authors below for "who wrote this PR" instead).
# $3 = newline-separated list of changed file paths, relative to repo root.
#
# Prints, per file, the top 3 authors by commit count (ties broken by most
# recent commit date) as "- <path>: Name (<n> commits, last <date>); ...", or
# "- <path>: no prior commit history (new file)". Caps at 60 files to bound
# worst-case runtime on a large merge PR, noting the cap explicitly rather
# than truncating silently.
#
# Security note: this deliberately runs `git log` (author/date metadata only,
# never file contents) directly against the real repo, NOT the isolated
# export — that is safe on its own, independent of Claude, because git
# history can only ever contain what was committed; an untracked/gitignored
# secret (e.g. .env) was never committed and so can never surface here.
# Claude itself is never given a Bash/git tool — this data is computed by
# this trusted script and handed to the prompt as plain text, so the model's
# tool access (Read/Grep/Glob only) is unchanged.
_claude_pr_analysis_file_contributors() {
  local repo_root="$1"
  local head_ref="$2"
  local files="$3"
  local max_files=60
  local seen=0
  local lines=()

  while IFS= read -r file; do
    [ -z "$file" ] && continue
    seen=$((seen + 1))
    if [ "$seen" -gt "$max_files" ]; then
      lines+=("... contributor lookup capped at ${max_files} files for this PR — remaining files omitted")
      break
    fi

    local authors
    authors="$(git -C "$repo_root" log --no-merges --format='%an|%ad' --date=short "$head_ref" -- "$file" 2>/dev/null \
      | awk -F'|' '
          { count[$1]++; if ($2 > last[$1]) last[$1] = $2 }
          END { for (a in count) printf "%d|%s|%s\n", count[a], last[a], a }
        ' \
      | sort -t'|' -k1,1nr -k2,2r \
      | head -3 \
      | awk -F'|' '{ printf "%s (%s commits, last %s); ", $3, $1, $2 }')"

    if [ -z "$authors" ]; then
      lines+=("- ${file}: no prior commit history (new file)")
    else
      lines+=("- ${file}: ${authors}")
    fi
  done <<< "$files"

  if [ "${#lines[@]}" -gt 0 ]; then
    printf '%s\n' "${lines[@]}"
  fi
}

# Args: $1 = PR number. Prints a comma-joined list of the unique author names
# across every commit in the PR (via `gh pr view --json commits`), or an
# empty string if the lookup fails for any reason — caller should treat empty
# as "unknown" and fall back gracefully; this is best-effort context, not
# required for the analysis to run.
_claude_pr_analysis_pr_authors() {
  local pr_number="$1"
  gh pr view "$pr_number" --json commits --jq '[.commits[].authors[].name] | unique | join(", ")' 2>/dev/null || true
}

# Args: $1 = full prompt text, $2 = working directory to scope Read/Grep/Glob
# to. Shared invocation plumbing — flags verified against claude CLI 2.1.210.
# Prints the Claude report to stdout (stderr merged in), or writes an error
# and returns non-zero.
_claude_pr_analysis_invoke() {
  local prompt="$1"
  local workdir="${2:-$PWD}"

  (cd "$workdir" && printf '%s' "$prompt" | claude -p --model sonnet --tools "Read,Grep,Glob" --permission-mode bypassPermissions --output-format text --no-session-persistence) 2>&1
}

# Args: $1 = diff text, $2 = label describing what's being analyzed (for the
# prompt), $3 = working directory to scope Read/Grep/Glob to (defaults to
# $PWD). ALWAYS pass an isolated, tracked-files-only checkout here (see
# scripts/pr-analysis/analyze-pr.sh) — never the caller's real working tree,
# since Read ignores .gitignore and could otherwise expose local secrets
# (e.g. a gitignored .env file) to a report that gets posted publicly on the
# PR. $4 = optional prior-contributors-per-file text block from
# _claude_pr_analysis_file_contributors (plain text, not a tool the model can
# call — see that function's security note).
# Prints the Claude report to stdout, or writes an error to stderr and
# returns non-zero.
#
# Developer-facing code review report for Bridge-Server PRs raised against
# develop — feature/product impact, project-convention enforcement, code
# quality, security, and testing guidance.
claude_pr_analysis_run() {
  local diff_text="$1"
  local label="$2"
  local workdir="${3:-$PWD}"
  local contributors_context="${4:-}"
  local diff_with_note
  diff_with_note="$(_claude_pr_analysis_prepare_diff "$diff_text")"

  local prompt
  prompt=$(cat <<PROMPT_EOF
Analyze the following git diff ($label) — a pull request raised against the
develop branch of Bridge-Server, a Node.js/Express + Sequelize/PostgreSQL
API for the Bridge Platform (a startup/investor/B2B matchmaking platform:
onboarding/KYC, connections, deal-room chat, subscriptions, admin
back-office, and a matching engine). Plain CommonJS throughout — no
TypeScript, no build step. Serves REST under /api/v1/* plus Socket.IO for
deal-room chat, and is consumed by a separate Next.js frontend
(Bridge-Web).

You have read-only access to the repository at the PR's head commit
(Read/Grep/Glob) — use it to check real impact, not just the patch hunks:
find other callers/usages of anything changed, and look at full file context
when the diff does not show enough surrounding lines to judge correctness.
Do not modify anything; you have no write/execute tools.

Project conventions (from this repo's CLAUDE.md — check the diff against
every one of these and flag violations explicitly):
- One-directional layering: routes → middleware → controllers → services →
  repositories → models. Controllers are thin HTTP glue and never touch
  models/repositories directly; only repositories touch Sequelize models.
- Services always return ServiceResponse.success/error
  (src/utils/ServiceResponse.js) and never throw across the service
  boundary — errors are caught, logged via errorLogger, and converted.
  Multi-step writes wrap repository calls in sequelize.transaction() and
  roll back on failure (reference pattern: src/services/connectionService.js).
- Controllers translate service results into HTTP responses via
  HttpResponse.success/error (src/utils/HttpResponse.js).
- Routes wire authMiddleware (plus adminMiddleware/subscriptionMiddleware
  where relevant) and a Joi validate(schema) middleware BEFORE the
  controller handler; routers are mounted under /api/v1/... in src/app.js.
  A new route without validation or auth middleware needs an explicit
  justification.
- Config is read through src/configs/env_configs.js, not process.env
  directly.
- User-facing message strings, enums, and status/role tables belong in
  src/utils/constant.js (ROLES, TOKEN_TYPES, CONNECTION_STATUS,
  SOCKET_EVENTS, ...) — inlined strings/enums are a violation. Role checks
  compare against ROLES, never hardcoded role names.
- Matching-engine tunables (scoring weights, eligible role pairs, revenue
  bands, geo tiers, ...) belong in src/matching/matchingConfig.js, not
  scattered through services.
- Socket event names come from SOCKET_EVENTS; server-initiated pushes into a
  deal room go through emitToDealRoom (src/sockets/dealRoomChannel.js), not
  ad-hoc io.emit calls.
- File uploads use the multer configs and ClamAV scanBuffer() in
  src/configs/scan.js — a new upload endpoint that bypasses scanning or the
  mimetype/size allowlists is a security flag.
- Code style (eslint): 4-space indentation, required semicolons, no trailing
  commas, no bare console.log — use the Winston loggers
  (applicationLogger/errorLogger from src/configs/logger.js) or
  console.info/warn/error.

Produce a report structured EXACTLY as these three titles and their
subsections, in this order:

## What changed
### Feature Changes
Plain-language summary of what changed and why, avoiding jargon.
### User-facing impact
What will behave differently for API consumers and end users of the
platform, endpoint by endpoint / flow by flow if relevant.
### Risks associated
Business/product-level risk — scope creep, timeline risk, anything that
changes what was originally agreed.
### Decisions needed
Anything that needs a call from a non-engineer before this ships.

## Code changes
### Suggested Reviewers
First, state plainly who authored this PR (from the "Authors of the commits
in this PR" data below) — always name them, even if this is their first
change in the codebase. Then, separately, summarize who else has previously
worked on the impacted files/areas (from the "Contributors before this PR"
data below) as additional people worth looping in for a second opinion. If a
file shows no prior history, say so rather than guessing — do not conflate
the two groups.
### What changed
Technical summary of the change (architecture, approach).
### API contract changes
New, changed, or removed routes in src/routes/*.js and their mounting in
src/app.js; changed Joi validation schemas (request contract changes);
changed response shapes returned through HttpResponse; new/changed/removed
Socket.IO events (SOCKET_EVENTS in src/utils/constant.js and the handlers in
src/sockets/); and Sequelize model changes (src/models/*.js). For any model
change, call out explicitly that migrations/ is gitignored in this repo — a
model change implies a migration that exists OUTSIDE this PR and must be
applied per environment; remind reviewers to confirm it. State explicitly if
there are no API contract changes.
### Impact Analysis
How this affects the rest of the codebase, informed by actually checking
callers/usages of anything changed elsewhere in the repo — not just the
patch hunks (e.g. other services calling a changed service, other routes
sharing a changed middleware or schema).
### Critical Risks
Correctness, backward-compatibility, data-integrity, or performance risks —
including missing transactions around multi-step writes and N+1 or
unbounded queries.
### Convention violations & inconsistencies
Violations of the project conventions listed above, plus places where this
change contradicts existing patterns or other code touching the same area.
### Code quality issues
With file:line references.
### Security issues
Missing/removed auth or validation middleware on routes; authorization
decisions made from client-supplied body/query fields instead of the
req.userId / req.roleId / req.companyId / req.role fields attached by
authMiddleware; raw SQL or sequelize.literal built from user input
(SQL injection); secrets committed to code; sensitive data (passwords,
tokens, OTPs, PII) flowing into applicationLogger — it logs full
request/response headers and bodies; upload endpoints bypassing the ClamAV
scan or loosening mimetype/size allowlists; JWT handling changes.

## Testing required
This repo has a Jest suite under src/tests/ (testMatch **/tests/**/*.test.js;
run with npm test, or npm run test:matching for the matching-engine suite).
### Test coverage
Which existing tests cover the changed code (check src/tests/), whether this
PR adds or updates tests, and what coverage is missing — name the specific
test files that should exist or be extended.
### Testing scenarios
Concrete API-level verification plan: which endpoints to call, with what
payloads, roles, and auth states, and the expected responses/side effects —
and why each matters. For each scenario, tag who wrote the change (the
author of this PR, from "Authors of the commits in this PR") and, where
useful, who else has prior history on that area (from "Contributors before
this PR"), so whoever executes the plan knows who to ask if something looks
wrong.
### Edge Cases
Edge cases and negative scenarios introduced or affected by this diff —
missing/malformed/empty payloads vs the Joi schemas, role differences
(super admin / admin / startup / investor / B2B enterprise), missing,
invalid, or expired JWTs, transaction-rollback paths, and any
pagination/empty-result states the change touches.
### Critical Risks
The riskiest paths to leave unverified before this merges — ranked, most
important first.

Keep every subsection tight and skimmable. Reference specific files and line
numbers. If a subsection genuinely has nothing to report, say so explicitly
rather than omitting it.

Contributor data (derived from git/GitHub by the calling script, not by you —
use this only to name people for the Suggested Reviewers and Testing
scenarios subsections above; do not otherwise treat it as evidence about the
change itself):
${contributors_context:-(unavailable for this analysis)}

Diff:
$diff_with_note
PROMPT_EOF
)

  _claude_pr_analysis_invoke "$prompt" "$workdir"
}
