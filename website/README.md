# DecisionPro website — forked redesign

A fork of the public marketing site **https://decisionpro.io**, redesign inside the
DecisionPro repository.

- **Forked from:** `decisionpro-web` repo (`https://github.com/kg-modus-novus/decisionpro-web`),
  `origin/main` @ `4f90b8f` — the content currently live at https://decisionpro.io.
- **Forked on:** 2026-09-03, via `../scripts/fork-website.ps1` (git archive of `origin/main`,
  evidence history and `.cursor` rules excluded — this repo carries its own).
- **Redesign:** same product truth, new presentation — dark "intelligence briefing"
  aesthetic, animated evidence constellation hero, and two deep-dive sections:
  - **Operational Intelligence — the Headlines.** The ranked briefing strip verbatim
    (11 Kentucky + 11 Florida headlines, quoted from the app's current
    `operationalBriefings.js` output), with the governance rules that make a headline
    trustworthy (fact + open question, never a verdict; observed / inferred / gap kinds).
  - **Funding & Resilience Intelligence.** Plain-language tour of the Funding &
    Resilience Evidence Room: 9 federal sources, 10 signal types, 2,863 organization
    signals (1,530 KY / 1,333 FL), ownership graphs, identity crosswalks, and the
    "review candidate, not a finding" guardrails.
- Product screenshots under `assets/screens/` include curated captures from this repo's
  isolated-render evidence (`docs/evidence/harness-workbench/isolated/…`), copied by
  `../scripts/website-assets.ps1`.

A product of **XenoDroid Inc.**

## Local preview

```powershell
npm run dev
```

Open http://localhost:5045

## Verify

```powershell
npm run verify
```

Headless render gate (title, hero, 22 headline cards, KY/FL toggle, state cards,
comparison table, image loading, desktop/mobile overflow) with screenshots written to
`docs/evidence/website-redesign/`.

## Notes

Static site — no build step. The production site remains the separate
`decisionpro-web` repo; this fork does not deploy. Do not add PHI, secrets, or
person-level Medicaid data.
