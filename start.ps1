# Starts Ghostrun on http://localhost:5180 in this terminal, so it keeps running on its own.
# It asks for the Meta Model API key once and keeps it only in this terminal's memory: it is never written to disk.
# Stop it with Ctrl+C or by closing the terminal.  Run:  npm run local
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
if (-not $env:MODEL_API_KEY) {
  $secure = Read-Host -Prompt 'Meta Model API key (not saved anywhere)' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:MODEL_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not (Test-Path node_modules)) { npm install }
npm run build
node src/server.mjs
