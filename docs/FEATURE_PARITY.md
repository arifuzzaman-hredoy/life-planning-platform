# Original project feature parity

The uploaded reference defines behavior; the current Life Planning design stays in place. The owner explicitly excluded the finished Exam Mode and will add a DeepSeek key in AI Settings. Existing imported records and credentials must be preserved.

Implementation checklist:

- AI assistant: full page, floating access, persistent conversations, new/clear/delete chats, copy replies, quick prompts, scoped workspace/file context, text/code attachments, save attachments to vault, proposed note/file actions and optional automatic application. Encrypted server-side key settings; never return saved keys to clients.
- Vault: multiple uploads, categories/types/subjects, search/filter, metadata editing, private image/PDF/text/code previews, downloads, explicit deletion, storage limits and ownership checks.
- Automation: study reminder, night review, weekly review draft, backup readiness report, actual application/database health, rule-based daily planner, file classification review. Manual run/all, schedules, notifications, read state and history. No exam countdown. External email/Telegram/Drive were placeholders in the reference and must not be represented as configured services.
- Progress: certificate/project progress, category/status/type filters, grouped/list views, detailed stages and direct editing.
- Roadmap sections: academic, IELTS/SAT, Cloud/DevOps, AI automation, debate, Rover Scout, contests, personal skills, country strategy, weekly routine, identity, target document and remove-from-life. Use existing saved entries, not copied personal datasets in source control.
- Project case studies: stage, stack, GitHub/live/demo links, problem, solution and impact.
- Monthly review: month, score, completed/failed/improved/ignored fields, next targets and distractions to remove, persisted history.
- Backup/restore: export personal records and safely restore missing records; separate private file downloads and server backups.
- Printable target document, motivation rotation, language/theme preferences and the existing search/CRUD workflows.

Verification must include ownership isolation, malformed/oversized inputs, secret handling, AI context isolation, action replay prevention, provider failure without fabricated responses, persistent uploads, backup round trip, schedules, and desktop/mobile browser checks. Production migration and deployment require an isolated project backup and preservation of unrelated VPS services.

Provider implementation references: [DeepSeek chat API](https://api-docs.deepseek.com/api/create-chat-completion/), [JSON output](https://api-docs.deepseek.com/guides/json_mode/), [current model identifiers](https://api-docs.deepseek.com/). Checked September 2026; the reference's old model alias is replaced with the supported configurable model selection.

## Using the restored features

Open **AI Assistant → AI Settings**, paste your own DeepSeek key, and save. You can also configure it under Settings. The server stores an encrypted key and returns only connection status. Select General, a field, all plans/files, or specific vault files before sending. Recent conversation messages are included; start a new conversation for a fresh context. Text/code attachments can be read; image/PDF contents are not interpreted by this text integration. Suggestions require Apply unless you explicitly enable automatic application. Chat history is stored with your account.

Document Vault accepts multiple uploads, up to 25 MB each and 250 MB per account. Files are stored privately in PostgreSQL and included in the server's database backups. Personal JSON exports include plans, logs, finance, reviews and chat text, but exclude passwords, keys and file bytes. Download original files separately. Restore previews the incoming records and adds only missing records; existing edits remain intact.

Automation Hub runs seven routines manually or on a schedule in your account timezone. Scheduled routines start disabled. Enable the ones you want after choosing times. Notifications are delivered inside the app. The daily planner uses saved priorities and deterministic rules; it does not pretend to call an AI provider. The backup readiness routine reports counts; the separate server backup job creates the actual database dump. No email, Telegram or Google Drive delivery is configured.

The current interface is retained. Navigation/headings support Bangla and English, saved content remains bilingual as imported, and light/dark theme preference persists. Roadmaps, certificate stages, project case-study fields, monthly review history and printable targets use the same saved workspace records. Completed Exam Mode remains excluded.

## Server configuration

Set a random `APP_CRON_SECRET` of at least 32 characters in the private runtime environment before deploying. Install `scripts/schedule.py` in the project's tools directory and the added line from `infra/cron/life-planning` in its existing cron file. The caller uses loopback, checks the bearer token, and records only the latest result in `state/automations-last.json`. Jobs use per-owner locks and time-slot deduplication.

`AI_ENCRYPTION_KEY` can hold a separate stable encryption secret; otherwise the application derives encryption from `SESSION_SECRET`. Keep that secret with private disaster-recovery material. Changing the active encryption secret requires re-entering saved DeepSeek keys. No provider key is included in source control or environment examples.

The additive reference-feature migration creates private vault, chat, settings, automation and notification tables. Back up the project database before deploying. The project Nginx vhost allows 26 MB requests and waits 90 seconds for AI responses. File-content routes allow same-origin previews while keeping uploaded content sandboxed and preventing MIME sniffing.
