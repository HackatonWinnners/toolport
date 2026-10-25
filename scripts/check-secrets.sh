#!/usr/bin/env bash
# Pre-commit guard: refuse staged secret files and Stellar secret seeds.
# Install: ln -s ../../scripts/check-secrets.sh .git/hooks/pre-commit
set -euo pipefail

blocked_paths='(^|/)\.env(\.[^/]*)?$|(^|/)\.wallets/|(^|/)\.mcp\.json$|(^|/)\.claude/|\.db(-[^/]*)?$|\.sqlite$'
status=0

while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in *.env.example) continue ;; esac
  if [[ "$path" =~ $blocked_paths ]]; then
    echo "check-secrets: refusing to commit $path" >&2
    status=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR)

# Stellar secret seeds: S + 55 base32 chars. Only added lines are checked; the match itself is never printed.
if git diff --cached -U0 --diff-filter=ACMR | grep -E '^\+' | grep -qE 'S[A-Z2-7]{55}'; then
  echo "check-secrets: a staged change contains a Stellar secret seed (S...)" >&2
  status=1
fi

# Credential-shaped assignments and JWTs (FACILITATOR_API_KEY, SESSION_SECRET, Turso tokens); examples are exempt.
if git diff --cached -U0 --diff-filter=ACMR -- . ':(exclude)*.example' ':(exclude)**/.env.example' | grep -E '^\+' |
  grep -qE '(API_KEY|SECRET|TOKEN|PASSWORD)[A-Z_]*["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9_./+-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.'; then
  echo "check-secrets: a staged change looks like a credential (API key, secret, token or JWT)" >&2
  status=1
fi

exit $status
