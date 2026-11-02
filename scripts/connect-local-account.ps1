[CmdletBinding()]
param([string]$Email)
$ErrorActionPreference = 'Stop'
if (-not $Email) { $Email = Read-Host '기존 admin 기록에 연결할 가입 이메일' -MaskInput }
$Email = $Email.Trim()
if ($Email.Length -gt 254 -or $Email -notmatch '^[\x21-\x7e]+@[^@]+\.[^@]+$') {
    throw '영문 이메일 주소를 입력하세요.'
}
# The designated address is inherited in memory only, never written to state or command arguments.
$previous = $env:AUTH_LOCAL_ADMIN_EMAIL
try {
    $env:AUTH_LOCAL_ADMIN_EMAIL = $Email
    & (Join-Path $PSScriptRoot 'api-dev.ps1') -Action Restart
    Write-Host '연결 준비 완료. 지정한 이메일로 가입한 뒤 확인 링크를 완료하고 로그인하세요.'
    Write-Host '기존에 이메일 확인을 완료한 계정은 이 자동 연결 대상이 아닙니다.'
} finally {
    $env:AUTH_LOCAL_ADMIN_EMAIL = $previous
}
