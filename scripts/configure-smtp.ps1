[CmdletBinding()]
param(
    [ValidateSet('Gmail', 'Brevo')]
    [string]$Provider = 'Gmail',
    [switch]$SendTestMail,
    [switch]$CheckOnly,
    [switch]$UpdateCredentials
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'smtp-credentials.ps1')
$ProgressPreference = 'SilentlyContinue'
$repoRoot = Split-Path $PSScriptRoot -Parent
$keys = @('AUTH_SMTP_PROVIDER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD',
    'AUTH_MAIL_FROM', 'APP_PUBLIC_URL', 'SMTP_TEST_RECIPIENT')
$statusFile = Join-Path $repoRoot '.local/smtp-setup-status.json'
New-Item -ItemType Directory -Path (Split-Path $statusFile -Parent) -Force | Out-Null
@{ status = 'waiting'; provider = $Provider.ToLowerInvariant() } | ConvertTo-Json | Set-Content -LiteralPath $statusFile
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
$securePassword = $null
$passwordPointer = [IntPtr]::Zero
try {
    Write-Host '한달살림 실제 메일 연결. 주소와 키는 Windows 계정으로 암호화해 로컬에 저장하며 코드·로그·명령 인수에는 남기지 않습니다.'
    if ($UpdateCredentials) {
        foreach ($key in (Get-SmtpEnvironmentKeys)) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
    } elseif (-not $env:AUTH_SMTP_PROVIDER -and $IsWindows) {
        $null = Import-SmtpCredentials
        if ($env:AUTH_SMTP_PROVIDER -and $env:AUTH_SMTP_PROVIDER -ne $Provider.ToLowerInvariant()) {
            foreach ($key in (Get-SmtpEnvironmentKeys)) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
        }
    }
    $login = $env:SMTP_USER
    if (-not $login) { $login = Read-Host 'SMTP 로그인 (Gmail은 전체 Gmail 주소)' -MaskInput }
    $login = $login.Trim()
    if ($Provider -eq 'Gmail' -and $login -notmatch '^[A-Za-z0-9._+%-]+@gmail\.com$') {
        throw '개인 Gmail의 전체 주소를 입력하세요.'
    }
    $sender = if ($Provider -eq 'Gmail') { $login } else { $env:AUTH_MAIL_FROM }
    if (-not $sender) { $sender = Read-Host '인증 완료한 발신 이메일' -MaskInput }
    if ($sender -notmatch '^[\x21-\x7e]+@[^@]+\.[^@]+$') { throw '발신 주소 형식을 확인하세요.' }
    $publicUrl = $env:APP_PUBLIC_URL
    if (-not $publicUrl) { $publicUrl = 'http://localhost:3000' }
    $origin = $null
    if (-not [Uri]::TryCreate($publicUrl, [UriKind]::Absolute, [ref]$origin) -or
        $origin.UserInfo -or $origin.Query -or $origin.Fragment -or
        $origin.AbsolutePath -notin @('', '/') -or
        ($origin.Scheme -ne 'https' -and -not ($origin.Scheme -eq 'http' -and $origin.Host -in @('localhost', '127.0.0.1')))) {
        throw 'APP_PUBLIC_URL은 HTTPS 사이트 주소 또는 로컬 http://localhost:3000 이어야 합니다.'
    }
    if (-not $env:SMTP_PASSWORD) {
        $securePassword = Read-Host 'SMTP 전용 키 (Gmail은 앱 비밀번호, 일반 비밀번호 사용 금지)' -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $env:SMTP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    }
    if ($Provider -eq 'Gmail') { $env:SMTP_PASSWORD = $env:SMTP_PASSWORD -replace '\s', '' }
    if (-not $env:SMTP_PASSWORD -or ($Provider -eq 'Gmail' -and $env:SMTP_PASSWORD -notmatch '^[A-Za-z]{16}$')) {
        throw 'Gmail은 16자리 앱 비밀번호를 입력하세요. 다른 서비스는 SMTP 키가 필요합니다.'
    }
    $env:AUTH_SMTP_PROVIDER = $Provider.ToLowerInvariant()
    $env:SMTP_HOST = if ($Provider -eq 'Gmail') { 'smtp.gmail.com' } else { 'smtp-relay.brevo.com' }
    $env:SMTP_PORT = '587'
    $env:SMTP_USER = $login
    $env:AUTH_MAIL_FROM = $sender.Trim()
    $env:APP_PUBLIC_URL = $publicUrl
    $env:SMTP_TEST_RECIPIENT = $null
    if ($SendTestMail) {
        $recipient = if ($Provider -eq 'Gmail') { $login } else { Read-Host '테스트 메일 수신 주소' -MaskInput }
        if ($recipient -notmatch '^[\x21-\x7e]+@[^@]+\.[^@]+$') { throw '수신 주소 형식을 확인하세요.' }
        $env:SMTP_TEST_RECIPIENT = $recipient.Trim()
    }
    Push-Location (Join-Path $repoRoot 'apps/api')
    try {
        & .\gradlew.bat --no-daemon --quiet smtpCheck
        if ($LASTEXITCODE -ne 0) { throw 'SMTP 연결을 확인하지 못했습니다. 기존 실행 서버는 변경하지 않았습니다.' }
    } finally { Pop-Location }
    # The test recipient is only for the standalone probe, never the application server.
    $env:SMTP_TEST_RECIPIENT = $null
    if (-not $CheckOnly) {
        Save-SmtpCredentials
        & (Join-Path $PSScriptRoot 'api-dev.ps1') -Action Restart
        Write-Host '실제 SMTP 연결 적용 완료. 가입 확인·재설정 메일은 실제 수신함으로 전송됩니다.'
    }
    @{ status = if ($CheckOnly) { 'checked' } else { 'configured' }; provider = $Provider.ToLowerInvariant(); testMailAccepted = [bool]$SendTestMail; completedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $statusFile
    if (-not $CheckOnly) { Write-Host '암호화 저장 완료. 같은 Windows 계정에서는 서버 재시작·PC 재부팅 후에도 자동으로 불러옵니다.' }
} catch {
    @{ status = 'failed'; provider = $Provider.ToLowerInvariant() } | ConvertTo-Json | Set-Content -LiteralPath $statusFile
    throw
} finally {
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    if ($securePassword) { $securePassword.Dispose() }
    $login = $null; $sender = $null; $recipient = $null
}
