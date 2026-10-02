---
title: Configuration
parent: Get Started
nav_order: 2
---

# Configuration Reference

## Layered authentication

Test privilege boundaries by configuring multiple roles:

```json
{
  "auth": {
    "methods": ["jwt", "api_key", "body_role"],
    "credentials": [
      { "email": "admin@company.com", "password": "admin123", "role": "admin" },
      { "email": "user@company.com", "password": "user123", "role": "user" },
      { "email": "guest@company.com", "password": "guest123", "role": "guest" }
    ],
    "apiKeys": {
      "admin": "ak_admin_001",
      "user": "ak_user_002",
      "guest": "ak_guest_003"
    }
  }
}
```

## Sensitive pattern coverage

Define regex patterns that the judge should flag as data exposure:

```json
{
  "sensitivePatterns": [
    "sk-[a-zA-Z0-9]{20,}",
    "xoxb-[0-9a-zA-Z-]{30,}",
    "AKIA[0-9A-Z]{16}",
    "ghp_[A-Za-z0-9]{36}",
    "\\b\\d{3}-\\d{2}-\\d{4}\\b",
    "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
    "internal-id-\\d+",
    "customer-\\d{8}",
    "project-phoenix",
    "merger-codename",
    "confidential-budget"
  ]
}
```

## Attack tuning knobs

```json
{
  "attackConfig": {
    "adaptiveRounds": 2,
    "maxAttacksPerCategory": 10,
    "concurrency": 3,
    "delayBetweenRequestsMs": 200,
    "enableAdaptiveMultiTurn": true,
    "maxAdaptiveTurns": 12,
    "strategiesPerRound": 6,
    "judgeConfidenceThreshold": 75
  }
}
```

## Adaptive PAIR loop

Seeds the target refuses are fed back to the attacker model together with the
target's exact reply, the judge verdict, and the observed defense profile; the
attacker revises one element and retries, until the attack lands or the per-seed
query budget is spent. Measured on `google/gemma-4-31b-it` with a deepseek
attacker: yield 7.4% → 11.1% (+50%), real breaks 8 → 27. Requires
`enableLlmGeneration`.

```json
{
  "attackConfig": {
    "enablePairLoop": true,
    "maxAdaptiveQueriesPerSeed": 8,
    "pairLoopMaxSeedsPerCategory": 4
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `enablePairLoop` | `false` | Turn the loop on. Also exposed as the **Adaptive PAIR Loop** toggle in the dashboard's attack configuration step. |
| `maxAdaptiveQueriesPerSeed` | `8` | Query budget per refused seed, including its first attempt. Each retry is one extra target query + one attacker call + one judge call. |
| `pairLoopMaxSeedsPerCategory` | `4` | How many refused seeds per category enter the loop (per round). Caps run time and cost. |

PAIR-produced results carry ids of the form `pair-<category>-r<round>-q<n>-<seed id>`
and a strategy label suffixed `→ PAIR q<n>`, so they are traceable in reports.

## Speed vs thoroughness presets

**Fast iteration (development):**

```json
{
  "adaptiveRounds": 1,
  "maxAttacksPerCategory": 3,
  "concurrency": 5,
  "enableLlmGeneration": false,
  "customAttacksOnly": true
}
```

**Comprehensive assessment (production):**

```json
{
  "adaptiveRounds": 3,
  "maxAttacksPerCategory": 15,
  "concurrency": 2,
  "enableLlmGeneration": true,
  "enableDiscovery": true
}
```

{: .tip }
Batch similar attacks to reuse auth tokens, tune concurrency to target rate limits, and stream large result sets rather than loading them in memory.
