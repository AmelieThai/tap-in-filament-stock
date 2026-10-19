@echo off
cd /d "%~dp0"
if not exist ".venv-windows\Scripts\python.exe" (
 echo Run Installer-Windows.bat first.
 pause
 exit /b 1
)
".venv-windows\Scripts\python.exe" server.py
pause
