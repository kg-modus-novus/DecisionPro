param(
  [ValidateRange(5040, 5049)]
  [int]$Port = 5041
)

$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$vitePath = Join-Path $appRoot 'node_modules\vite\bin\vite.js'

if (-not (Test-Path -LiteralPath $vitePath)) {
  throw "Vite was not found at $vitePath. Run npm install for the DecisionPro app first."
}

Set-Location -LiteralPath $appRoot
& node.exe $vitePath preview --host 127.0.0.1 --port $Port --strictPort
exit $LASTEXITCODE
