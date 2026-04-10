# Hunt AI

> AI-powered job search automation — multi-board discovery, contact enrichment, and personalized outreach generation.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000?style=flat&logo=next.js&logoColor=white)
![Convex](https://img.shields.io/badge/Convex-FF6B35?style=flat&logo=data:image/svg+xml;base64,&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

---

## What It Does

Hunt AI automates the grunt work of job searching. You configure your profile once, then it continuously discovers jobs, researches companies, finds decision makers, and drafts personalized outreach — all visible in a real-time web dashboard.

### Two Flows

**Flow 1: Auto-Discovery**
Scans 9+ job sources in parallel, scores and ranks results, discovers decision makers at each company, enriches contacts with emails, and generates outreach drafts.

**Flow 2: Target Company**
You paste a LinkedIn or YC URL. The system scrapes company info, finds open roles, discovers people (founders, CTOs, engineering leads), checks LinkedIn connection status, and generates warm, personalized messages.

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Board Job Search** | Scrapes LinkedIn, Indeed, Glassdoor, Google Jobs, Naukri, YC, Wellfound, Instahyre, HN via [python-jobspy](https://github.com/Bunsly/JobSpy) + direct adapters |
| **Contact Discovery** | LinkedIn People tab (LLM extraction), WebSearch, [CrossLinked](https://github.com/m8sec/CrossLinked) (Google/Bing dorking — never touches LinkedIn) |
| **Email Enrichment** | Name + domain permutation with DNS MX validation. No API keys needed |
| **Connection-Aware Outreach** | Detects LinkedIn connection status. Connected = direct DM. Not connected = connection request + follow-up |
| **YC Detection** | Auto-detects YC companies in discovery flow, generates "Reach out to the team" portal messages |
| **WhatsApp Outreach** | Generates WhatsApp messages when phone numbers are available |
| **10-Dimension Scoring** | North Star, CV Match, Seniority, Compensation, Growth, Remote, Reputation, Tech Stack, Speed, Culture |
| **Company Intelligence** | Funding stage, AI maturity, pain points, competitors, tech stack — 7 parallel searches per company |
| **Real-Time Dashboard** | Next.js + Convex. Live updates, score filtering, approve/skip actions, copy-to-clipboard outreach |
| **Target Company Pipeline** | Paste a LinkedIn/YC URL → full research + outreach in minutes |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Web Dashboard                     │
│              (Next.js + Tailwind CSS)                │
│   Leads · Targets · Outreach · Pipeline · Profile    │
└──────────────────────┬──────────────────────────────┘
                       │ Real-time subscriptions
┌──────────────────────▼──────────────────────────────┐
│                  Convex Backend                      │
│     agentItems · agentRuns · agents · schema          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP mutations/queries
┌──────────────────────▼──────────────────────────────┐
│               TypeScript Runner                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Discovery │  │ Research │  │    Outreach Gen    │  │
│  │ (9 srcs)  │  │ (Intel)  │  │ (LI/Email/WA/YC)  │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Scoring  │  │ DM Find  │  │  Email Enrichment  │  │
│  │ (10-dim) │  │ (3 srcs) │  │  (permute + MX)    │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────┘
        │                │
   python-jobspy     CrossLinked
   (subprocess)      (subprocess)
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+ (for jobspy + CrossLinked)
- A [Convex](https://convex.dev) account (free tier works)
- An [Anthropic API key](https://console.anthropic.com)

### Setup

```bash
# 1. Clone
git clone https://github.com/apoorva1509/hunt-ai.git
cd hunt-ai

# 2. Install dependencies
npm install
pip install python-jobspy crosslinked

# 3. Set up Convex
cd web && npm install && npx convex dev   # Creates your Convex deployment

# 4. Configure environment
#    Set ANTHROPIC_API_KEY and CONVEX_URL in your environment

# 5. Configure your profile
cp config/profile.example.yml config/profile.yml
# Edit config/profile.yml with your name, target roles, salary range, etc.

# 6. Add your resume
# Create cv.md in the project root with your resume in markdown

# 7. Start the dashboard
cd web && npm run dev                      # http://localhost:3000

# 8. Start the runner (in a separate terminal)
cd runner/job-hunter && npx tsx index.ts --watch
```

### Search Configuration

Edit `config/search-profiles/bangalore-startups.yml` (or create your own):

```yaml
location: Bangalore
remote: false

title_filter:
  positive:
    - "Software Engineer"
    - "AI Engineer"
    - "Tech Lead"
  negative:
    - "Junior"
    - "Intern"

sources:
  - jobspy        # LinkedIn + Indeed + Glassdoor + Google
  - yc_wats       # YC Work at a Startup
  - naukri         # Direct HTML scraper
  - linkedin       # Via SearXNG
  - wellfound      # Via SearXNG
  - hn_hiring      # HN Who's Hiring (Algolia)
  - topstartups    # TopStartups.io
```

## Job Sources

| Source | Method | Reliability |
|--------|--------|-------------|
| **JobSpy** (LinkedIn, Indeed, Glassdoor, Google) | Python subprocess, direct scraping | High |
| **Naukri** | Direct HTML scraper with JSON-LD | High |
| **YC Work at a Startup** | Direct fetch + parse | High |
| **HN Who's Hiring** | Algolia API | High |
| **TopStartups.io** | Direct fetch | Medium |
| **LinkedIn** (standalone) | SearXNG `site:` search | Low |
| **Wellfound, Instahyre, Cutshort** | SearXNG `site:` search | Low |

## Contact Discovery

Three sources run in parallel for each company:

1. **LinkedIn People Tab** — Playwright scrapes the company page, Claude Haiku extracts actual employees from page text (avoids CSS selector brittleness)
2. **WebSearch** — Searches for `"{company}" CTO CEO Founder site:linkedin.com/in` with company name validation
3. **CrossLinked** — Google/Bing dorking to find employee names without touching LinkedIn (avoids rate limits)

After discovery, emails are enriched via name+domain permutation with MX record validation.

## Project Structure

```
hunt-ai/
├── web/                          # Next.js dashboard
│   ├── app/(app)/
│   │   ├── leads/                # Job leads with scoring
│   │   ├── targets/              # Target company research
│   │   ├── outreach/             # Outreach management
│   │   └── pipeline/             # Pipeline overview
│   ├── hooks/                    # Convex data hooks
│   └── lib/types.ts              # Shared type definitions
├── convex/                       # Convex backend
│   ├── schema.ts                 # Database schema
│   ├── agentItems.ts             # Items CRUD
│   └── agentRuns.ts              # Run management
├── runner/job-hunter/            # TypeScript pipeline runner
│   ├── index.ts                  # Main orchestrator + watch mode
│   ├── research.ts               # Job discovery + DM search
│   ├── target-company.ts         # Target company pipeline
│   ├── portal-scanner.ts         # Source-based scanner
│   ├── crosslinked.ts            # CrossLinked wrapper
│   ├── email-enrichment.ts       # Email permutation + MX
│   ├── yc-detection.ts           # YC company detection
│   ├── linkedin.ts               # Playwright LinkedIn automation
│   ├── job-scoring.ts            # 10-dimension scoring
│   ├── messages.ts               # Outreach generation
│   └── sources/                  # Source adapters
│       ├── jobspy.source.ts      # python-jobspy adapter
│       ├── jobspy_search.py      # Python scraper script
│       ├── naukri.source.ts      # Direct HTML scraper
│       └── ...                   # 8 more adapters
└── config/
    └── search-profiles/          # Search configuration YAML
```

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, Lucide icons
- **Backend**: [Convex](https://convex.dev) (real-time database + subscriptions)
- **Runner**: TypeScript (tsx), Playwright for browser automation
- **AI**: Claude Opus (synthesis, outreach), Claude Haiku (classification, extraction)
- **Job Scraping**: [python-jobspy](https://github.com/Bunsly/JobSpy) (LinkedIn, Indeed, Glassdoor, Google)
- **Employee Discovery**: [CrossLinked](https://github.com/m8sec/CrossLinked) (Google/Bing dorking)
- **Email Validation**: Node.js `dns` module (MX record lookup)

## Disclaimer

This is a local, open-source tool. Your data stays on your machine. You are responsible for complying with the Terms of Service of any platforms you interact with (LinkedIn, Indeed, etc.). Do not use this tool to spam employers. Always review AI-generated content before sending.

## License

MIT
