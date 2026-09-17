# DecisionPro marketing DNS

Cutover complete. Live marketing:

- https://DecisionPro.io
- https://www.DecisionPro.io
- https://decisionpro-web.vercel.app (fallback)

Demo CTAs point to https://demo.DecisionPro.io (GitHub Pages). Do not point `demo` at Vercel.

## GoDaddy records (applied)

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `demo` | `kg-modus-novus.github.io` |

## Vercel

- Team: `modus-novus`
- Project: `decisionpro-web`
- Domains: `decisionpro.io`, `www.decisionpro.io` (attached and verified)
