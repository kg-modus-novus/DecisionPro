# DecisionPro DNS and hosting

Status as of 2026-07-30 (cutover complete; public resolvers may take up to ~1 hour for apex TTL):

| Surface | URL | Host |
|---|---|---|
| Product demo | https://demo.DecisionPro.io | GitHub Pages (`kg-modus-novus/DecisionPro`) |
| Product demo (fallback) | https://kg-modus-novus.github.io/DecisionPro/ | GitHub Pages |
| Marketing | https://DecisionPro.io · https://www.DecisionPro.io | Vercel (`modus-novus/decisionpro-web`) |
| Marketing (fallback) | https://decisionpro-web.vercel.app | Vercel |
| Ask Sam API (demo) | https://decisionpro-ask-sam.vercel.app | Vercel (`modus-novus/decisionpro-ask-sam`); Pages uses `VITE_ASK_SAM_API_BASE` |

LMDSys GitHub Pages (`https://kg-modus-novus.github.io/LMDSys/`) remains untouched.

## GoDaddy DNS (applied)

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `demo` | `kg-modus-novus.github.io` |

## GitHub Pages

- Source: `gh-pages` / root
- Custom domain: `demo.DecisionPro.io`
- Enforce HTTPS: enabled
- Certificate: approved

## Vercel

- Project: `modus-novus/decisionpro-web`
- Domains attached: `decisionpro.io`, `www.decisionpro.io`
