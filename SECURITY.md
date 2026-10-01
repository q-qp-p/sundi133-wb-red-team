# Security Policy

## Scope

This policy covers vulnerabilities in **wb-red-team itself**: the CLI, attack engine, dashboard, and deployment configs in this repository. Examples include credential leakage from configs or reports, command injection, or unsafe handling of target responses.

It does **not** cover weaknesses that wb-red-team finds in the systems you test with it. Report those to the owner of the affected system.

## Supported Versions

Security fixes are applied to the latest release on the `main` branch.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately through [GitHub Security Advisories](https://github.com/votal-ai-hq/ai-red-teaming/security/advisories/new).

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Affected version or commit
- Any suggested fix

## What to Expect

- **Acknowledgement** within 3 business days
- **Initial assessment** within 10 business days
- **Fix and disclosure:** we aim to release a fix within 90 days and will coordinate the disclosure timeline with you

Reporters are credited in the advisory unless they ask not to be.

## Handling Secrets

wb-red-team handles API keys and target credentials. Never commit real credentials, session cookies, or scan reports from real targets. Use `.env` (git-ignored) and the `*.example.json` configs as templates.
