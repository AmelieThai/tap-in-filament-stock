[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Program (exit $LASTEXITCODE)" }
}
try {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        Invoke-Checked -Program 'py' -Arguments @('-3', '-c', 'import sys; assert sys.version_info >= (3,10), "Python 3.10 or later required"')
        Invoke-Checked -Program 'py' -Arguments @('-3', '-m', 'venv', '.venv-windows')
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        Invoke-Checked -Program 'python' -Arguments @('-c', 'import sys; assert sys.version_info >= (3,10), "Python 3.10 or later required"')
        Invoke-Checked -Program 'python' -Arguments @('-m', 'venv', '.venv-windows')
    } else {
        throw 'Install Python from https://www.python.org/downloads/windows/ with the Python launcher, then run this installer again.'
    }
    $Python = Join-Path $PSScriptRoot '.venv-windows\Scripts\python.exe'
    Invoke-Checked -Program $Python -Arguments @('-m', 'pip', 'install', '-r', 'requirements.txt')
    Invoke-Checked -Program $Python -Arguments @('-m', 'py_compile', 'server.py', 'catalogue.py')
    Write-Host 'Ready! Double-click Start-Windows.bat.' -ForegroundColor Yellow
    Write-Host 'Keep the server running. Allow Python through Windows Firewall on PRIVATE networks only.'
} catch {
    Write-Error $_
    exit 1
}
