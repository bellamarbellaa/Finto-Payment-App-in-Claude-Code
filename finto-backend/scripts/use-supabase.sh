#!/usr/bin/env bash
#
# Point this backend at Supabase without the password ever passing through a
# shell argument (where it would land in your shell history) or a chat message.
# It is typed at a hidden prompt and written straight into .env.
#
#   ./scripts/use-supabase.sh [project-ref]
#
set -euo pipefail

cd "$(dirname "$0")/.."

# Your project ref is the subdomain in the Supabase dashboard URL.
# Pass it as an argument, or set SUPABASE_PROJECT_REF in your shell.
PROJECT_REF="${1:-${SUPABASE_PROJECT_REF:-}}"

if [ -z "$PROJECT_REF" ]; then
  echo "Usage: $0 <project-ref>" >&2
  echo "  Find it in your Supabase dashboard URL:" >&2
  echo "  https://supabase.com/dashboard/project/<project-ref>" >&2
  exit 1
fi
HOST="db.${PROJECT_REF}.supabase.co"

if [ ! -f .env ]; then
  echo "No .env found. Run: cp .env.example .env" >&2
  exit 1
fi

# Keep a copy — this rewrites the database line.
cp .env ".env.backup.$(date +%Y%m%d-%H%M%S)"

printf 'Supabase database password for %s\n' "$PROJECT_REF"
printf '(Settings -> Database -> Database password; input is hidden): '
read -rs PASSWORD
printf '\n'

if [ -z "$PASSWORD" ]; then
  echo "No password entered; nothing changed." >&2
  exit 1
fi

# Percent-encode the characters a Postgres URL treats specially, so a password
# containing @ : / ? # or & does not corrupt the connection string.
ENCODED=$(PASSWORD="$PASSWORD" python3 -c 'import os,urllib.parse;print(urllib.parse.quote(os.environ["PASSWORD"], safe=""))')

URL="postgresql://postgres:${ENCODED}@${HOST}:5432/postgres"

# Replace the DATABASE_URL line in place, leaving every other setting alone.
URL="$URL" python3 <<'PY'
import os, pathlib

url = os.environ['URL']
path = pathlib.Path('.env')
out, replaced = [], False

for line in path.read_text().splitlines():
    if line.startswith('DATABASE_URL='):
        if not replaced:
            out.append(f'DATABASE_URL={url}')
            replaced = True
        # A later duplicate is dropped; otherwise the last one would win.
    else:
        out.append(line)

if not replaced:
    out.append(f'DATABASE_URL={url}')

path.write_text('\n'.join(out) + '\n')
PY

echo
echo "OK — .env now points at ${HOST}"
echo
echo "Next:"
echo "  npm run db:migrate    # create the tables"
echo "  npm run db:seed       # load Sofia's data"
echo "  npm run dev"
