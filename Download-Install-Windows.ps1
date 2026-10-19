# Download and install the public TAP IN repository on Windows.
# Requires Windows Package Manager (winget). No GitHub account required.
[CmdletBinding()]
param(
    [string]$Destination = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'TAP-IN')
)
$ErrorActionPreference = 'Stop'
if (Test-Path $Destination) { throw "Destination already exists: $Destination. Installation stopped to preserve existing data." }
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'Install App Installer (Windows Package Manager) from Microsoft Store, then retry.'
}
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    & winget install --id Python.Python.3.13 -e
    if ($LASTEXITCODE -ne 0) { throw 'Python installation failed. Install Python with its launcher, then retry.' }
}
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$TempFolder = Join-Path $env:TEMP ('tap-in-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $TempFolder | Out-Null
try {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/AmelieThai/tap-in-filament-stock/archive/refs/heads/main.zip' -OutFile (Join-Path $TempFolder 'app.zip')
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
        # Only this script's uniquely named temporary directory is removed.
    if (Test-Path $TempFolder) { Remove-Item $TempFolder -Recurse -Force }
}
