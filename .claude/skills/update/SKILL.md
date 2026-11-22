---
name: update
description: Trigger the FCZ Radar data refresh (GitHub Actions workflow update-data) and report the result. Use when the user types "/update", "update quick", "update seasons", "update full", or asks to refresh or update the app data.
argument-hint: "[quick|seasons|full]"
---

# Update FCZ Radar data

Mode: `$ARGUMENTS`. If it is empty, use `quick`. Allowed modes:
- `quick`: dbFCZ home page, forum index, FotMob (about 30 s)
- `seasons`: quick plus the current dbFCZ seasons (1–2 min)
- `full`: re-crawl of all dbFCZ seasons (several minutes)

If the mode is anything else, ask which of the three modes is meant and do nothing else.

## Steps

1. Trigger the run:
   `gh workflow run update-data.yml -R ginlennon/fcz-radar -f mode=<mode>`
2. Wait about 5 s, then get the newest workflow_dispatch run:
   `gh run list -R ginlennon/fcz-radar -w update-data --event workflow_dispatch --limit 1 --json databaseId,status,createdAt`
3. Wait until it finishes (allow up to 15 min for `full`):
   `gh run watch <id> -R ginlennon/fcz-radar --exit-status --interval 10 > /dev/null`
4. Read the result from the log:
   `gh run view <id> -R ginlennon/fcz-radar --log | grep -v '36;1m' | grep -E "changed:|no changes|STEP .* FAILED"`

## Report

Reply in one or two lines: the mode, success or failure, whether new data was committed (a `changed: [...]` line
lists the files, `no changes` means nothing new), and any `STEP … FAILED` line. The site picks up new data about
30 s after the commit.

## If gh is refused

If step 1 fails with 403, 404 or "Resource not accessible", stop and tell the user. In a Claude Code cloud session
the GitHub connection may not be allowed to start workflow runs. The fix is a fine-grained GitHub token limited to
this repository with "Actions: Read and write" only, stored as `GH_TOKEN` in the cloud environment's settings. Do not
try any other way to trigger the run.
