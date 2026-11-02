# Local development only. DPAPI binds the entire payload (including the login) to
# the current Windows account and computer. No encryption key is stored in Git.
function Get-SmtpCredentialPath {
    if (-not $IsWindows) { throw 'Saved SMTP credentials require Windows.' }
    $workspace = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent)).ToLowerInvariant()
    $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($workspace))).Substring(0, 24)
    return Join-Path $env:LOCALAPPDATA "HandalSallim/credentials/$digest/smtp.dpapi"
}

function Get-SmtpEnvironmentKeys {
    return @('AUTH_SMTP_PROVIDER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'AUTH_MAIL_FROM', 'APP_PUBLIC_URL')
}

function Save-SmtpCredentials([string]$Path = (Get-SmtpCredentialPath)) {
    if (-not $IsWindows) { throw 'Saved SMTP credentials require Windows.' }
    $secure = $null
    $temporary = $null
    try {
        $settings = @{}
        foreach ($key in (Get-SmtpEnvironmentKeys)) {
            $value = [Environment]::GetEnvironmentVariable($key, 'Process')
            if (-not $value) { throw 'Incomplete SMTP settings.' }
            $settings[$key] = $value
        }
        if ($settings.AUTH_SMTP_PROVIDER -notin @('gmail', 'brevo')) { throw 'Unknown SMTP provider.' }
        $directory = Split-Path $Path -Parent
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        $acl = [Security.AccessControl.DirectorySecurity]::new()
        $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl.SetOwner($owner)
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($identity in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
            $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
        }
        Set-Acl -LiteralPath $directory -AclObject $acl
        $secure = ConvertTo-SecureString -String (ConvertTo-Json -InputObject $settings -Compress) -AsPlainText -Force
        $encrypted = ConvertFrom-SecureString -SecureString $secure
        # Write/replace atomically so a failed save does not destroy the previous setup.
        $temporary = Join-Path $directory ([guid]::NewGuid().ToString('N') + '.tmp')
        [IO.File]::WriteAllText($temporary, $encrypted, [Text.Encoding]::ASCII)
        [IO.File]::Move($temporary, $Path, $true)
    } catch {
        throw 'Cannot securely save SMTP credentials. Existing server settings were not changed.'
    } finally {
        if ($secure) { $secure.Dispose() }
        if ($temporary -and (Test-Path -LiteralPath $temporary)) { Remove-Item -LiteralPath $temporary -Force }
        $settings = $null; $value = $null
    }
}

function Import-SmtpCredentials([string]$Path = (Get-SmtpCredentialPath)) {
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $secure = $null
    $pointer = [IntPtr]::Zero
    try {
        $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($Path)) -ErrorAction Stop
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $settings = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | ConvertFrom-Json -AsHashtable -ErrorAction Stop
        if ($settings.AUTH_SMTP_PROVIDER -notin @('gmail', 'brevo')) { throw 'Invalid settings.' }
        foreach ($key in (Get-SmtpEnvironmentKeys)) {
            if ($settings[$key] -isnot [string] -or -not $settings[$key]) { throw 'Incomplete settings.' }
        }
        # Validate everything before changing any environment value.
        foreach ($key in (Get-SmtpEnvironmentKeys)) {
            [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
        }
        return $true
    } catch {
        throw 'Saved SMTP credentials cannot be read by this Windows account. Run configure-smtp.ps1 -UpdateCredentials to replace them.'
    } finally {
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        if ($secure) { $secure.Dispose() }
        $settings = $null
    }
}
