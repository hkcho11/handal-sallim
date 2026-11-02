[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Restart', 'Status', 'Supervise')]
    [string]$Action = 'Start',
    [switch]$SkipBuild,
    [switch]$UseMailpit,
    [string]$SnapshotPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'smtp-credentials.ps1')
$repoRoot = Split-Path $PSScriptRoot -Parent
$runtimeRoot = Join-Path $repoRoot '.local/api'
$stateFile = Join-Path $runtimeRoot 'state.json'
$stopFile = Join-Path $runtimeRoot 'stop.request'
$eventLog = Join-Path $runtimeRoot 'supervisor.log'
$apiUrl = 'http://127.0.0.1:8081/api/auth/health'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

function Test-ApiReady {
    try {
        $response = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch { return $false }
}

function Read-State {
    if (Test-Path -LiteralPath $stateFile) {
        try { return Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json } catch {}
    }
    return $null
}

function Test-OwnedProcess($processId, $startedAt) {
    if (-not $processId -or -not $startedAt) { return $false }
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    return $process -and $process.StartTime.ToUniversalTime().Ticks -eq $startedAt
}

function Write-Event([string]$message) {
    Add-Content -LiteralPath $eventLog -Value "$(Get-Date -Format o) $message"
}

function Import-DatabaseEnvironment {
    if (-not $env:DB_PASSWORD) {
        # Read the already-running local container's password into memory only.
        # Never place credentials in arguments, state files or logs.
        $containers = @(docker ps --filter 'publish=5432' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}')
        if ($LASTEXITCODE -ne 0 -or $containers.Count -ne 1) {
            throw 'Start local PostgreSQL and set DB_PASSWORD before starting the API.'
        }
        $password = docker exec $containers[0] printenv POSTGRES_PASSWORD
        if ($LASTEXITCODE -ne 0 -or -not $password) { throw 'Local database credentials are unavailable.' }
        $env:DB_PASSWORD = $password
    }
    if ($env:AUTH_SMTP_PROVIDER -and $env:AUTH_SMTP_PROVIDER -notin @('gmail', 'brevo')) {
        throw 'AUTH_SMTP_PROVIDER must be gmail or brevo, or unset for Mailpit.'
    }
    $env:SPRING_PROFILES_ACTIVE = if ($env:AUTH_SMTP_PROVIDER) { 'local,mail-smtp' } else { 'local' }
}

function Assert-MailEnvironment($state) {
    if ($UseMailpit) {
        $env:AUTH_SMTP_PROVIDER = $null
        $env:SMTP_HOST = '127.0.0.1'
        $env:SMTP_PORT = '1025'
        $env:SMTP_USER = $null
        $env:SMTP_PASSWORD = $null
        $env:SMTP_AUTH = 'false'
        $env:SMTP_STARTTLS = 'false'
        $env:AUTH_MAIL_FROM = $null
    } elseif (-not $env:AUTH_SMTP_PROVIDER) {
        if ($IsWindows) { $null = Import-SmtpCredentials }
        if ($state -and $state.mailProvider -in @('gmail', 'brevo') -and -not $env:AUTH_SMTP_PROVIDER) {
            throw 'No saved SMTP credentials are available. Run scripts/configure-smtp.ps1 once, or explicitly select -UseMailpit. Existing server was left running.'
        }
    }
    if ($env:AUTH_SMTP_PROVIDER) {
        if ($env:AUTH_SMTP_PROVIDER -notin @('gmail', 'brevo')) { throw 'Unknown AUTH_SMTP_PROVIDER.' }
        foreach ($key in @('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'AUTH_MAIL_FROM', 'APP_PUBLIC_URL')) {
            if (-not [Environment]::GetEnvironmentVariable($key, 'Process')) {
                throw "Real SMTP requires $key in the server environment. No configured value was logged."
            }
        }
    }
}

function New-Snapshot {
    if (-not $SkipBuild) {
        Push-Location (Join-Path $repoRoot 'apps/api')
        try {
            & .\gradlew.bat bootJar | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'API build failed; the existing server was left running.' }
        } finally { Pop-Location }
    }
    $jar = Get-ChildItem -LiteralPath (Join-Path $repoRoot 'apps/api/build/libs') -Filter '*.jar' |
        Where-Object Name -NotLike '*-plain.jar'
    if (@($jar).Count -ne 1) { throw 'Build one executable API jar before starting.' }
    $snapshot = Join-Path $runtimeRoot ("api-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$([guid]::NewGuid().ToString('N')).jar")
    Copy-Item -LiteralPath $jar.FullName -Destination $snapshot
    return $snapshot
}

function Stop-Supervisor {
    $state = Read-State
    if (-not $state) { return }
    if (Test-OwnedProcess $state.supervisorPid $state.supervisorStartedAt) {
        Set-Content -LiteralPath $stopFile -Value 'stop'
        $deadline = (Get-Date).AddSeconds(25)
        while ((Get-Date) -lt $deadline -and (Test-OwnedProcess $state.supervisorPid $state.supervisorStartedAt)) {
            Start-Sleep -Milliseconds 500
        }
        if (Test-OwnedProcess $state.supervisorPid $state.supervisorStartedAt) {
            throw 'Supervisor has not stopped. Check .local/api/supervisor.log.'
        }
    }
    # Recover only this supervisor's child if the supervisor itself was interrupted.
    if (Test-OwnedProcess $state.childPid $state.childStartedAt) {
        Stop-Process -Id $state.childPid
    }
}

function Start-Supervisor([string]$snapshot) {
    Import-DatabaseEnvironment
    $shellPath = (Get-Process -Id $PID).Path
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"",
        '-Action', 'Supervise', '-SnapshotPath', "`"$snapshot`"")
    $supervisor = Start-Process -FilePath $shellPath -ArgumentList $arguments -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runtimeRoot 'supervisor.stdout.log') `
        -RedirectStandardError (Join-Path $runtimeRoot 'supervisor.stderr.log')
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        if ($supervisor.HasExited) { throw 'API supervisor exited. Check .local/api/supervisor.stderr.log.' }
        if (Test-ApiReady) {
            Write-Host 'API ready at http://127.0.0.1:8081 (automatic restart enabled).'
            return
        }
        Start-Sleep -Seconds 1
    }
    throw 'API is not ready yet. Check .local/api logs; the supervisor will continue retrying.'
}

if ($Action -eq 'Status') {
    $state = Read-State
    [pscustomobject]@{
        Ready = Test-ApiReady
        Supervised = [bool]($state -and (Test-OwnedProcess $state.supervisorPid $state.supervisorStartedAt))
        MailProvider = if ($state -and $state.mailProvider) { $state.mailProvider } else { 'mailpit' }
        RuntimeDirectory = $runtimeRoot
    }
    return
}
if ($Action -eq 'Stop') { Stop-Supervisor; Write-Host 'Managed API stopped.'; return }
if ($Action -ne 'Supervise') {
    $state = Read-State
    if ($Action -eq 'Start' -and $state -and (Test-OwnedProcess $state.supervisorPid $state.supervisorStartedAt)) {
        Write-Host "API supervisor is already running. Ready: $(Test-ApiReady)"
        return
    }
    $listener = Get-NetTCPConnection -State Listen -LocalPort 8081 -ErrorAction SilentlyContinue
    if ($listener -and (-not $state -or -not (Test-OwnedProcess $state.childPid $state.childStartedAt))) {
        throw 'Port 8081 belongs to an unmanaged process. Stop that API before using this launcher.'
    }
    Assert-MailEnvironment $state
    # Build before stopping: failed builds must not take a healthy API down.
    $snapshot = New-Snapshot
    Stop-Supervisor
    Start-Supervisor $snapshot
    return
}

# Only one supervisor may own this checkout, including concurrent start commands.
$lock = $null
$child = $null
try {
    try {
        $lock = [IO.File]::Open((Join-Path $runtimeRoot 'supervisor.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    } catch { return }
    $resolvedSnapshot = (Resolve-Path -LiteralPath $SnapshotPath).Path
    if (-not $resolvedSnapshot.StartsWith($runtimeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The runtime snapshot must belong to this checkout.'
    }
    if (Test-Path -LiteralPath $stopFile) { Remove-Item -LiteralPath $stopFile }
    $supervisorStartedAt = (Get-Process -Id $PID).StartTime.ToUniversalTime().Ticks
    $runId = [IO.Path]::GetFileNameWithoutExtension($resolvedSnapshot)
    $attempt = 0
    while (-not (Test-Path -LiteralPath $stopFile)) {
        if (Get-NetTCPConnection -State Listen -LocalPort 8081 -ErrorAction SilentlyContinue) {
            Write-Event 'Port 8081 is occupied; refusing to start a second API.'
            break
        }
        $attempt++
        $javaPath = (Get-Command java -ErrorAction Stop).Source
        $child = Start-Process -FilePath $javaPath -ArgumentList @('-jar', "`"$resolvedSnapshot`"") `
            -WorkingDirectory (Join-Path $repoRoot 'apps/api') -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $runtimeRoot "$runId-attempt-$attempt.stdout.log") `
            -RedirectStandardError (Join-Path $runtimeRoot "$runId-attempt-$attempt.stderr.log")
        @{
            supervisorPid = $PID; supervisorStartedAt = $supervisorStartedAt
            childPid = $child.Id; childStartedAt = $child.StartTime.ToUniversalTime().Ticks
            snapshot = $resolvedSnapshot
            mailProvider = if ($env:AUTH_SMTP_PROVIDER) { $env:AUTH_SMTP_PROVIDER } else { 'mailpit' }
        } | ConvertTo-Json | Set-Content -LiteralPath $stateFile
        Write-Event "Started API pid=$($child.Id), attempt=$attempt."
        $started = Get-Date
        $failures = 0
        $wasReady = $false
        while (-not $child.HasExited -and -not (Test-Path -LiteralPath $stopFile)) {
            if (Test-ApiReady) { $failures = 0; $wasReady = $true }
            elseif ($wasReady -or ((Get-Date) - $started).TotalSeconds -gt 60) { $failures++ }
            if ($failures -ge 3) { Write-Event 'API readiness failed three times; restarting.'; break }
            Start-Sleep -Seconds 3
        }
        if (-not $child.HasExited) { Stop-Process -Id $child.Id; $child.WaitForExit() }
        if (Test-Path -LiteralPath $stopFile) { break }
        Write-Event "API exited (code=$($child.ExitCode)); restarting."
        # Bound retries during database outages, but recover automatically afterward.
        $delay = if ($wasReady) { 2 } else { [Math]::Min(30, $attempt * 2) }
        for ($i = 0; $i -lt $delay -and -not (Test-Path -LiteralPath $stopFile); $i++) { Start-Sleep -Seconds 1 }
    }
} finally {
    if ($child -and -not $child.HasExited) { Stop-Process -Id $child.Id -ErrorAction SilentlyContinue }
    if ($lock) { $lock.Dispose(); Write-Event 'Supervisor stopped.' }
}
