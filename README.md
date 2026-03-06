# Salesforce Job Radar Agent

Public-safe template of the Salesforce job alert agent.

This repo includes:
- multi-source Salesforce job fetch
- Naukri + LinkedIn support
- dedupe and incremental alerting
- email + Telegram delivery
- resume match scoring
- tracker commands for apply/save/ignore

This public copy does not include:
- your API keys
- your GitHub secrets
- your private `.env`
- your personal base resume PDF

## Quick start

1. Copy `.env.example` to `.env`
2. Fill in your own values
3. Add your own resume PDF at `assets/resume/base/your_resume.pdf`
4. Run:

```bash
npm ci
npm run doctor
npm start
```

## GitHub Actions setup

The public template keeps the workflow on manual trigger only by default.

After you add your own GitHub Actions secrets and validate one manual run:
- open `.github/workflows/salesforce-job-radar-agent.yml`
- uncomment the `schedule` section
- optionally set `RESUME_ATTACH_BASE_PDF=true` after adding your own resume PDF

## Required secrets

- `APIFY_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `EMAIL_TO`

Recommended email delivery:
- `RESEND_API_KEY`
- `RESEND_FROM`
- `RESEND_REPLY_TO`

Optional:
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `OPENAI_API_KEY`
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

## Tracker shortcuts

```bash
npm run tracker -- summary
npm run tracker -- apply <job_hash_or_prefix>
npm run tracker -- save <job_hash_or_prefix>
npm run tracker -- ignore <job_hash_or_prefix>
npm run tracker -- note <job_hash_or_prefix> "Follow up in 2 days"
```

## Full setup

See [SETUP_FROM_SCRATCH.md](./SETUP_FROM_SCRATCH.md).
