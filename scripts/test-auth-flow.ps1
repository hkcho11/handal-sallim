# Real browser + API + PostgreSQL + SMTP check in disposable, isolated containers.
[CmdletBinding()]
param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repoRoot = Split-Path $PSScriptRoot -Parent
$runRoot = Join-Path $repoRoot ('.local/auth-flow/' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
$containers = @()
$api = $null
$previous = @{}
$keys = @('AUTH_FLOW_WEB_PORT', 'AUTH_FLOW_API_ORIGIN', 'AUTH_FLOW_MAILPIT_ORIGIN', 'AUTH_FLOW_MAILPIT_CONTAINER')
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
function Free-Port {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try { return $listener.LocalEndpoint.Port } finally { $listener.Stop() }
}
function Container-Port([string]$container, [string]$port) {
    $mapped = docker port $container $port
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve disposable container port.' }
    return [int]($mapped -split ':')[-1]
}
try {
    if (-not $SkipBuild) {
        Push-Location (Join-Path $repoRoot 'apps/api')
        try {
            $gradleRunner = if ($IsWindows) { '.\gradlew.bat' } else { './gradlew' }
            & $gradleRunner bootJar
            if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
        } finally { Pop-Location }
        & npx --yes pnpm@12.10.1 --dir (Join-Path $repoRoot 'apps/web') run build
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    $database = docker run -d -e POSTGRES_HOST_AUTH_METHOD=trust -p '127.0.0.1::5432' postgres:18.6
    if ($LASTEXITCODE -ne 0 -or $database -notmatch '^[0-9a-f]{64}$') { throw 'Cannot start isolated PostgreSQL.' }
    $containers += $database
    # Explicit host ports stay stable when the SMTP outage test restarts Mailpit.
    $smtpPort = Free-Port
    $mailboxPort = Free-Port
    $mailpit = docker run -d -p "127.0.0.1:${smtpPort}:1025" -p "127.0.0.1:${mailboxPort}:8025" axllent/mailpit:v1.27
    if ($LASTEXITCODE -ne 0 -or $mailpit -notmatch '^[0-9a-f]{64}$') { throw 'Cannot start isolated Mailpit.' }
    $containers += $mailpit
    $databasePort = Container-Port $database '5432/tcp'
    $smtpPort = Container-Port $mailpit '1025/tcp'
    $mailboxPort = Container-Port $mailpit '8025/tcp'
    $apiPort = Free-Port
    $webPort = Free-Port
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        docker exec $database pg_isready -U postgres 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Isolated database did not become ready.' }
    $jar = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'apps/api/build/libs') -Filter '*.jar' | Where-Object Name -NotLike '*-plain.jar')
    if ($jar.Count -ne 1) { throw 'Build one executable API jar.' }
    $snapshot = Join-Path $runRoot 'api.jar'
    Copy-Item -LiteralPath $jar[0].FullName -Destination $snapshot
    $environment = @{
        SPRING_PROFILES_ACTIVE = 'auth-flow-check'; SERVER_ADDRESS = '127.0.0.1'; SERVER_PORT = "$apiPort"
        DB_URL = "jdbc:postgresql://127.0.0.1:$databasePort/postgres"; DB_USER = 'postgres'; DB_PASSWORD = ''
        SMTP_HOST = '127.0.0.1'; SMTP_PORT = "$smtpPort"; SMTP_USER = ''; SMTP_PASSWORD = ''
        SMTP_AUTH = 'false'; SMTP_STARTTLS = 'false'; AUTH_SMTP_PROVIDER = ''; AUTH_LOCAL_ADMIN_EMAIL = ''
        AUTH_MAIL_FROM = 'noreply@auth-flow.test'; APP_PUBLIC_URL = "http://127.0.0.1:$webPort"
        AUTH_SECURE_COOKIES = 'false'; AUTH_CHECK_BREACHES = 'false'
        # Override direct Spring environment settings too: never inherit real DB/SMTP destinations.
        SPRING_APPLICATION_JSON = '{}'
        SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:$databasePort/postgres"
        SPRING_DATASOURCE_USERNAME = 'postgres'; SPRING_DATASOURCE_PASSWORD = ''
        SPRING_MAIL_HOST = '127.0.0.1'; SPRING_MAIL_PORT = "$smtpPort"
        SPRING_MAIL_USERNAME = ''; SPRING_MAIL_PASSWORD = ''
        SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH = 'false'
        SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE = 'false'
        SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_REQUIRED = 'false'
        SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE = 'false'
        APP_AUTH_MAIL_FROM = 'noreply@auth-flow.test'
        APP_AUTH_PUBLIC_URL = "http://127.0.0.1:$webPort"
        APP_AUTH_SECURE_COOKIES = 'false'; APP_AUTH_CHECK_BREACHES = 'false'
        APP_AUTH_LOCAL_ADMIN_EMAIL = ''
    }
    $apiWindowOptions = if ($IsWindows) { @{ WindowStyle = 'Hidden' } } else { @{} }
    $api = Start-Process @apiWindowOptions -FilePath (Get-Command java).Source -ArgumentList @('-jar', ('"' + $snapshot + '"')) `
        -Environment $environment -WorkingDirectory (Join-Path $repoRoot 'apps/api') -PassThru `
        -RedirectStandardOutput (Join-Path $runRoot 'api.stdout.log') -RedirectStandardError (Join-Path $runRoot 'api.stderr.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($api.HasExited) { throw "Isolated API exited. Inspect $runRoot." }
        try {
            $health = Invoke-WebRequest "http://127.0.0.1:$apiPort/api/auth/health" -TimeoutSec 2
            if ($health.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "Isolated API did not become ready. Inspect $runRoot." }
    $env:AUTH_FLOW_WEB_PORT = "$webPort"
    $env:AUTH_FLOW_API_ORIGIN = "http://127.0.0.1:$apiPort"
    $env:AUTH_FLOW_MAILPIT_ORIGIN = "http://127.0.0.1:$mailboxPort"
    $env:AUTH_FLOW_MAILPIT_CONTAINER = $mailpit
    & npx --yes pnpm@12.10.1 --dir (Join-Path $repoRoot 'apps/web') run test:auth-flow
    if ($LASTEXITCODE -ne 0) { throw 'Real authentication browser checks failed.' }
} finally {
    if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id; $api.WaitForExit() }
    foreach ($container in $containers) {
        if ($container -match '^[0-9a-f]{64}$') { docker rm -f $container 2>$null | Out-Null }
    }
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
