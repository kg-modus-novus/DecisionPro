# DecisionPro DNS and hosting

## Demo wireframe — `demo.DecisionPro.io`

Host: GitHub Pages from `kg-modus-novus/DecisionPro` (`gh-pages` branch).

GoDaddy DNS for `DecisionPro.io`:

| Type | Name | Value |
|---|---|---|
| CNAME | `demo` | `kg-modus-novus.github.io` |

GitHub Pages settings:

1. Source: Deploy from branch `gh-pages` / root
2. Custom domain: `demo.DecisionPro.io`
3. Enforce HTTPS after DNS verifies

Also available: `https://kg-modus-novus.github.io/DecisionPro/`

## Marketing site — `DecisionPro.io` / `www`

Host: Vercel project linked to `kg-modus-novus/decisionpro-web`.

Typical GoDaddy DNS after Vercel assigns values (confirm in Vercel domain UI):

| Type | Name | Value |
|---|---|---|
| A | `@` | Vercel A record(s) shown in dashboard |
| CNAME | `www` | `cname.vercel-dns.com` (or value Vercel shows) |

Add both `DecisionPro.io` and `www.DecisionPro.io` in the Vercel project domains panel.
