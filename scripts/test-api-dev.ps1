# Opt-in integration check. Requires local PostgreSQL and intentionally restarts the local API.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$launcher = Join-Path $PSScriptRoot 'api-dev.ps1'
$stateFile = Join-Path $repoRoot '.local/api/state.json'

& $launcher -Action Start
$before = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
& $launcher -Action Start
$duplicate = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
if ($before.supervisorPid -ne $duplicate.supervisorPid -or $before.childPid -ne $duplicate.childPid) {
    throw 'Repeated start launched duplicate processes.'
}
$snapshotHash = (Get-FileHash -LiteralPath $before.snapshot -Algorithm SHA256).Hash
Push-Location (Join-Path $repoRoot 'apps/api')
try {
    & .\gradlew.bat bootJar --rerun-tasks
    if ($LASTEXITCODE -ne 0) { throw 'API rebuild failed.' }
} finally { Pop-Location }
if ($snapshotHash -ne (Get-FileHash -LiteralPath $before.snapshot -Algorithm SHA256).Hash) {
    throw 'A build overwrote the running snapshot.'
}
$ready = Invoke-WebRequest 'http://127.0.0.1:8081/api/auth/health' -UseBasicParsing -TimeoutSec 5
if ($ready.StatusCode -ne 200) { throw 'The API failed after rebuilding.' }

# Identity check prevents accidentally stopping an unrelated process after PID reuse.
$child = Get-Process -Id $before.childPid
if ($child.StartTime.ToUniversalTime().Ticks -ne $before.childStartedAt) { throw 'API identity changed.' }
Stop-Process -Id $child.Id
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    $after = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ($after.childPid -ne $before.childPid) {
        try {
            $ready = Invoke-WebRequest 'http://127.0.0.1:8081/api/auth/health' -UseBasicParsing -TimeoutSec 3
            if ($ready.StatusCode -eq 200) {
                Write-Host 'PASS: repeated start, immutable runtime jar, and automatic crash recovery.'
                return
            }
        } catch {}
    }
}
throw 'The supervisor did not restore API readiness within 90 seconds.'
