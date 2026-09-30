# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Instead, report it
privately via GitHub's **Report a vulnerability** feature on the Security tab,
or email the maintainer.

Include a description, steps to reproduce, and any relevant request details.
We will acknowledge the report and work on a fix as soon as possible.

## Design notes

Security is enforced on the server, not by hiding the source code:

- The OpenRouter API key, model choice and system instructions live only in the
  serverless functions under `api/`. The browser cannot read or override them.
- Every AI request requires a signed-in session and is rate limited per user.
- Supabase Row Level Security keeps profiles owner-only. Profile `credits` and
  `role` columns are protected by column-level grants and a database trigger.
- The `consume_ai_credit` and `increment_ai_usage` database functions are
  executable only by the `service_role`; the browser cannot call them.

Do not commit secrets. Environment files (`.env*`, except `.env.example`) are
gitignored; if a key is ever exposed, rotate it immediately.
