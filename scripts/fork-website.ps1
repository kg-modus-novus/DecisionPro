# One-time scaffold: seed website/ fork from the decisionpro-web marketing repo (origin/main).
param(
  [string]$MarketingRepo = 'C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\dev\marketing local repo',
  [string]$LocalRepo = 'C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\dev\local repo'
)
$ErrorActionPreference = 'Stop'
$tmp = Join-Path $env:TEMP 'decisionpro-web-fork.tar'
$dst = Join-Path $LocalRepo 'website'
git -C $MarketingRepo archive origin/main -o $tmp
New-Item -ItemType Directory -Force -Path $dst | Out-Null
tar -xf $tmp -C $dst
Remove-Item $tmp -Force
# Keep the fork lean: fresh verification evidence will be generated, not inherited.
Remove-Item (Join-Path $dst 'docs\evidence') -Recurse -Force -ErrorAction SilentlyContinue
# The enclosing repo already carries Scriptorium rules.
Remove-Item (Join-Path $dst '.cursor') -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Name $dst
