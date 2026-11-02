# Uses synthetic credentials only; never reads or changes the real saved setup.
[CmdletBinding()]
param([switch]$VerifyOnly, [string]$StorePath)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'smtp-credentials.ps1')
$keys = Get-SmtpEnvironmentKeys
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
$fixture = @{
    AUTH_SMTP_PROVIDER = 'gmail'; SMTP_HOST = 'smtp.gmail.com'; SMTP_PORT = '587'
    SMTP_USER = 'synthetic-fixture@example.test'; SMTP_PASSWORD = 'synthetic-fixture-password'
    AUTH_MAIL_FROM = 'synthetic-fixture@example.test'; APP_PUBLIC_URL = 'http://localhost:3000'
}
$testDirectory = $null
try {
    if ($VerifyOnly) {
        foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
        if (-not (Import-SmtpCredentials -Path $StorePath)) { throw 'Child process did not restore credentials.' }
        foreach ($key in $keys) {
            if ([Environment]::GetEnvironmentVariable($key, 'Process') -cne $fixture[$key]) { throw 'Child process restored incorrect settings.' }
        }
        Write-Host 'PASS: credentials restored in a fresh process.'
        return
    }
    $testDirectory = Join-Path ([IO.Path]::GetTempPath()) ('handal-smtp-test-' + [guid]::NewGuid().ToString('N'))
    $path = Join-Path $testDirectory 'fixture.dpapi'
    if (Import-SmtpCredentials -Path $path) { throw 'A missing store must not restore credentials.' }
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $fixture[$key], 'Process') }
    Save-SmtpCredentials -Path $path
    $ciphertext = [IO.File]::ReadAllText($path)
    if ($ciphertext.Contains($fixture.SMTP_USER) -or $ciphertext.Contains($fixture.SMTP_PASSWORD)) { throw 'Credential store contains plaintext.' }
    $env:SMTP_PASSWORD = $null
    $saveRejected = $false
    try { Save-SmtpCredentials -Path $path } catch { $saveRejected = $true }
    if (-not $saveRejected -or [IO.File]::ReadAllText($path) -cne $ciphertext) { throw 'Failed save damaged the previous setup.' }
    $env:SMTP_PASSWORD = $fixture.SMTP_PASSWORD
    $acl = Get-Acl -LiteralPath $testDirectory
    if (-not $acl.AreAccessRulesProtected) { throw 'Credential directory inherits permissions.' }
    $current = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    foreach ($rule in $acl.Access) {
        $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        if ($sid -notin @($current, 'S-1-5-18')) { throw 'Unexpected access to credential directory.' }
    }
    $shellPath = (Get-Process -Id $PID).Path
    & $shellPath -NoProfile -File $PSCommandPath -VerifyOnly -StorePath $path
    if ($LASTEXITCODE -ne 0) { throw 'Fresh process test failed.' }
    [IO.File]::WriteAllText($path, 'invalid-encrypted-fixture')
    $rejected = $false
    try { $null = Import-SmtpCredentials -Path $path } catch { $rejected = $true }
    if (-not $rejected) { throw 'Corrupted credentials were accepted.' }
    foreach ($key in $keys) {
        if ([Environment]::GetEnvironmentVariable($key, 'Process') -cne $fixture[$key]) { throw 'Failed import changed the environment.' }
    }
    Write-Host 'PASS: encrypted login/password, restricted ACL, missing/corrupt store and unchanged environment.'
} finally {
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    if ($testDirectory -and (Test-Path -LiteralPath $testDirectory)) {
        $resolved = [IO.Path]::GetFullPath($testDirectory)
        $expectedParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
        if (-not $resolved.StartsWith($expectedParent, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'handal-smtp-test-*') { throw 'Refusing unexpected test cleanup path.' }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
