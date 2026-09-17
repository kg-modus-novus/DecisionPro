# One-time scaffold: copy curated product screenshots into the website fork and remove temp probes.
param(
  [string]$LocalRepo = 'C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\dev\local repo'
)
$ErrorActionPreference = 'Stop'
$screens = Join-Path $LocalRepo 'website\assets\screens'
$evidence = Join-Path $LocalRepo 'docs\evidence\harness-workbench\isolated'

Copy-Item (Join-Path $evidence '20260901T150935426Z\fl-funding-resilience-ownership-graph.png') (Join-Path $screens 'ofr-ownership-graph.png') -Force
Copy-Item (Join-Path $evidence '20260901T173842081Z\ky-funding-resilience-ownership-playbook.png') (Join-Path $screens 'ofr-ownership-playbook.png') -Force
Copy-Item (Join-Path $evidence '20260830T171047275Z\local-ky-operational.png') (Join-Path $screens 'ky-operational-briefing.png') -Force
Copy-Item (Join-Path $evidence '20260902T213719069Z\ky-relationship-evidence-table.png') (Join-Path $screens 'ky-relationship-evidence.png') -Force

Remove-Item (Join-Path $LocalRepo 'wireframe V1\app\print-briefings.mjs') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $LocalRepo 'wireframe V1\app\print-ofr-stats.mjs') -Force -ErrorAction SilentlyContinue

Get-ChildItem -Name $screens
