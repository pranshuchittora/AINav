# Content and public snapshot sync Implementation Plan

> **For agentic workers:** Use executing-plans to implement tasks in this session. No delegation is required.

**Goal:** Deliver the approved Claude guide, review topic content, and publish reproducible public snapshots from the two private local collectors.

**Architecture:** Keep AINav_art ignored. A standard-library Python exporter selects public fields into ainews/api and skill/api; a Node builder creates static pages sharing a small browser viewer. The existing navigation build remains authoritative.

**Tech Stack:** Python 3.10+, Node 20+, static HTML/CSS/JavaScript.

**Spec:** docs/2026-10-21-content-and-claude-research.md; user approved scope and specified only webpages/public data should sync.

## Global Constraints

- No private configuration, database, notification metadata, tokens or collector source is exported.
- Existing source data is read-only during export; no paid analysis or notifications are triggered.
- Historical collection dates remain visible; exporting is not collecting.
- Match existing site styling and navigation; support mobile and keyboard access.

## Review Focus

- Stale database: export latest available dates instead of an empty calendar window.
- Missing/corrupt input: fail before changing public data.
- Unsafe source URLs and HTML: allow only http(s) links and render content as text.
- Global sort and search: filter the whole dataset before pagination, including label pages.
- Private fields: recursively project known public fields, never copy a directory wholesale.

### Task 1: Public data export and sync

Files: scripts/sync-public-content.py, scripts/test-public-content.py, docs/public-content-sync.md.

- [x] Write and run regression tests for stale-date export, field allowlists, missing input, unsafe URLs and no writes on failed export.
- [x] Implement read-only SQLite and JSON projections, validate both sources before writing; produce manifests recording source dates separately from export dates.
- [x] Export current local snapshots; document local sync and optional existing external collector workflows.

### Task 2: Public viewers and collector defects

Files: scripts/build-content-pages.js, content-viewer.js, content-viewer.css, ainews/, skill/; local ignored collectors as needed.

- [x] Build entry/category/archive pages from public JSON, with search, sort, pagination, dates, stale and empty states, source links and shared navigation.
- [x] Correct confirmed private generator defects locally and document their ignored status.
- [x] Verify filters, deep links, reload persistence and mobile layout in a real browser; static checks cover missing assets, unit tests cover empty and boundary results.

### Task 3: Claude guide and topic updates

Files: claude-account-safety.html, nav-links.json, coding-plan.html, token-optimization.html, topic audit data and related pages.

- [x] Build approved guide with official citations, scenarios, checklists, troubleshooting and copyable appeal template.
- [x] Inventory top-level content pages; add dated updates to 18 topics and explicitly scope remaining historical tables. Full price and benchmark re-verification remains documented work.
- [x] Run existing build/checks and new content checks; inspect local navigation, sitemap and generated artifact changes.

The scripts do not commit or push automatically. The user's request to sync only public content to GitHub authorizes a reviewed public-content commit; source programs remain ignored. Remote hosting and scheduled collector setup are separate from content synchronization.

## Final review ledger

- A fresh reviewer found legacy GitHub records lacked visibility metadata. Added anonymous verification with 24-hour evidence, rejected unknown/private records, and fixed the local collector to search public repositories and retain visibility.
- A fresh reviewer found label pages lost the explicit all-category state on reload. Preserved `category=` and verified reload behavior in the browser.
- Review passed after fixes. Python: 6 tests. Node: 4 tests. Public page, asset and navigation checks: 83 pages. Local Go package compiles; no Go unit tests existed.
- Anonymous visibility check: 336/406 repository names verified, resulting in 341/411 exported records. No notifications or paid analysis were run.
