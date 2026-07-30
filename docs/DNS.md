# DecisionPro DNS and hosting

Status as of 2026-07-30 (agent cutover):

| Surface | Live now | Intended after GoDaddy DNS |
|---|---|---|
| Product demo | https://kg-modus-novus.github.io/DecisionPro/ | https://demo.DecisionPro.io |
| Marketing | https://decisionpro-web.vercel.app | https://DecisionPro.io / https://www.DecisionPro.io |

LMDSys GitHub Pages (`https://kg-modus-novus.github.io/LMDSys/`) is intentionally untouched.

## Demo wireframe — `demo.DecisionPro.io`

Host: GitHub Pages from `kg-modus-novus/DecisionPro` (`gh-pages` branch).

Until the GoDaddy record below exists, Pages custom domain is **cleared** so
`https://kg-modus-novus.github.io/DecisionPro/` serves the DecisionPro wireframe
without redirecting to an unresolved hostname.

### GoDaddy DNS (Director)

| Type | Name | Value |
|---|---|---|
| CNAME | `demo` | `kg-modus-novus.github.io` |

### After DNS propagates

1. GitHub → DecisionPro → Settings → Pages → Custom domain: `demo.DecisionPro.io`
2. Wait for DNS check to pass
3. Enable **Enforce HTTPS**
4. Optionally add a `CNAME` file containing `demo.DecisionPro.io` on the `gh-pages` branch
5. Point marketing CTAs back to `https://demo.DecisionPro.io` (see DecisionPro-web)

## Marketing site — `DecisionPro.io` / `www`

Host: Vercel project `modus-novus/decisionpro-web`  
Repo: `kg-modus-novus/decisionpro-web`

Vercel already has both domains attached and aliased to the production deployment.
Certificates will issue after DNS points at Vercel.

### GoDaddy DNS (Director) — recommended A-record path

Keep GoDaddy nameservers (`ns47` / `ns48.domaincontrol.com`). Add:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Alternate apex targets Vercel also accepts: `216.150.1.1` and `216.150.16.1`.  
Alternate www target: `29457a222df34ae1.vercel-dns-016.com`.

### Optional nameserver path

Point the domain’s nameservers to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`
instead of managing A/CNAME records in GoDaddy. Do **not** do this if you prefer
to keep `demo` on GitHub Pages via a GoDaddy CNAME (A-record path above is simpler).

### Do not point at Vercel

| Type | Name | Value |
|---|---|---|
| CNAME | `demo` | must remain `kg-modus-novus.github.io` |
