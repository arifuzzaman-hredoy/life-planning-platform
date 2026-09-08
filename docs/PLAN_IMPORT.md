# Importing an existing plan

The operator tool imports a private JSON manifest into one existing account. It defaults to a dry run. Keep source ZIPs, extracted personal data and manifests in ignored `.reference/` or `.private/` directories; never commit them or credentials.

Before applying an import, back up the `life_planning` schema using the operations backup command in the deployment guide. Read and map source data as data; do not execute an uploaded project's application code. Exclude sections the owner no longer wants.

```powershell
npx tsx scripts/import-plan.ts --file .private/plan.json --owner owner@example.com
npx tsx scripts/import-plan.ts --file .private/plan.json --owner owner@example.com --commit
```

`DATABASE_URL` (or `DIRECT_DATABASE_URL`) is read from the environment / ignored `.env`. The tool uses a verified direct Neon connection and changes only entries belonging to the specified existing account. It does not create users, reset passwords, change finance records or generate completion history.

```json
{
  "version": 1,
  "source": "my-original-roadmap",
  "records": [
    {
      "key": "goal/cloud",
      "entry": {
        "kind": "goal",
        "title": "Build cloud skills",
        "progress": 25,
        "notes": "Preserve original targets and bilingual notes here."
      }
    },
    {
      "key": "project/deployment",
      "entry": {
        "kind": "project",
        "title": "Deploy my application"
      },
      "links": { "goal": "goal/cloud" }
    }
  ]
}
```

Entries must pass the same field, URL, length and kind-specific validation as the app. Links use keys from the same manifest, with valid goal/project/parent types. Raw database relationship IDs, duplicate keys, self-links and parent cycles are rejected. A manifest is limited to 5,000 entries and 20 MiB.

IDs are derived from the account, source namespace and record key. Keep source names and keys stable when retrying. A transaction and the application's per-owner advisory lock protect each import. All missing entries are inserted together; an error rolls back that transaction. Existing entries are skipped, preserving the user's edits. Accounts and unrelated data remain untouched. A deleted imported entry will be recreated if it remains in a later manifest; remove its key before retrying if deletion was intentional.

Keep year-only targets in notes/tags or yearly entries without inventing exact deadlines. Label source defaults, subjective scores and unconfigured automation ideas accurately. Document checklists do not imply that proof attachments were included. Do not invent habit logs, study sessions, financial transactions or journal history.

After import, verify counts and linked entries through the authenticated live workspace, check excluded sections are absent, and open populated pages on desktop and mobile. Keep a private copy of the manifest, source checksum, dry-run report, import report and backup reference. A second dry run should report zero missing records. No application redeployment is needed for a data-only import.
