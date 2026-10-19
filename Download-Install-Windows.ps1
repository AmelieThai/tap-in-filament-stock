# Download and install the private TAP IN repository on Windows.
# Requires Windows Package Manager (winget). GitHub authentication is interactive.
[CmdletBinding()]
param(
    [string]$Destination = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'TAP-IN')
)
$ErrorActionPreference = 'Stop'
if (Test-Path $Destination) { throw "Destination already exists: $Destination. Installation stopped to preserve existing data." }
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'Install App Installer (Windows Package Manager) from Microsoft Store, then retry.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue) -and -not (Test-Path "$env:ProgramFiles\GitHub CLI\gh.exe")) {
    & winget install --id GitHub.cli -e
    if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI installation failed.' }
}
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    & winget install --id Python.Python.3.13 -e
    if ($LASTEXITCODE -ne 0) { throw 'Python installation failed. Install Python with its launcher, then retry.' }
}
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$GhCommand = Get-Command gh -ErrorAction SilentlyContinue
$GhPath = if ($GhCommand) { $GhCommand.Source } else { "$env:ProgramFiles\GitHub CLI\gh.exe" }
& $GhPath auth status --hostname github.com 2>$null
if ($LASTEXITCODE -ne 0) {
    & $GhPath auth login --hostname github.com --web --git-protocol https
    if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in failed.' }
}
$TempFolder = Join-Path $env:TEMP ('tap-in-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $TempFolder | Out-Null
$Token = $null
try {
    $Token = & $GhPath auth token --hostname github.com
    if ($LASTEXITCODE -ne 0 -or -not $Token) { throw 'No GitHub token available.' }
    Invoke-WebRequest -UseBasicParsing -Uri 'https://api.github.com/repos/AmelieThai/tap-in-filament-stock/zipball/main' -Headers @{ Authorization = "Bearer $Token" } -OutFile (Join-Path $TempFolder 'app.zip')
    $Token = $null
    Expand-Archive (Join-Path $TempFolder 'app.zip') (Join-Path $TempFolder 'source')
    $Folders = @(Get-ChildItem (Join-Path $TempFolder 'source') -Directory)
    if ($Folders.Count -ne 1 -or -not (Test-Path (Join-Path $Folders[0].FullName 'Install-Windows.ps1'))) { throw 'Unexpected repository archive.' }
    Move-Item $Folders[0].FullName $Destination
    Push-Location $Destination
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Destination 'Install-Windows.ps1')
        if ($LASTEXITCODE -ne 0) { throw 'Application setup failed. See the message above.' }
        Write-Host "Installed in $Destination" -ForegroundColor Yellow
        Write-Host 'Starting TAP IN. Keep the server window open.'
        & (Join-Path $Destination 'Start-Windows.bat')
    } finally { Pop-Location }
} finally {
    $Token = $null
    # Only this script's uniquely named temporary directory is removed.
    if (Test-Path $TempFolder) { Remove-Item $TempFolder -Recurse -Force }
}
