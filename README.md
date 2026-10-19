# TAP IN — Filament Stock

Private local-network inventory for Bambu Lab filament. English interface, black and yellow theme, iPhone photo/live scanning, five cabinets, quantities and a local barcode catalogue.

## Windows installation (PowerShell)

1. Download this repository with **Code → Download ZIP**, then extract it completely into a writable folder (for example Documents\TapIn).
2. Install Python 3.10 or later from [python.org](https://www.python.org/downloads/windows/) with the Python launcher.
3. Double-click `Installer-Windows.bat`. It runs `Install-Windows.ps1`, creates a Windows virtual environment and installs dependencies. Internet is required for this first installation.
4. Double-click `Start-Windows.bat` and leave its window open. Allow Python through Windows Firewall on **private networks only**. No administrator rights or router port forwarding are required by the app.
5. On your phone, open the HTTPS network address displayed in the server window (port 8443).

From PowerShell in the extracted folder:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Windows.ps1
.\Start-Windows.bat
```

The execution policy argument applies only to this installer process. It does not change the machine's execution policy. Review the script before running it.

## iPhone setup

Connect to the same Wi-Fi as the Windows PC. Download the public certificate from `http://PC-IP:8081/tap-in-root.cer` in Safari. Install **TAP IN Local CA** in Settings → General → VPN & Device Management, then enable trust in General → About → Certificate Trust Settings. Open `https://PC-IP:8443` and allow the camera. You may add this page to the home screen.

The PC must stay awake and the server must remain running. The local IP may change: reserve it in your router if desired. No stock is served on port 8081, only the public setup certificate.

## Transfer existing stock from Mac

Stop the app on the Mac before copying the complete `data` folder privately into the Windows application folder. This preserves your SQLite stock, learned barcode associations and local certificate authority. Never upload this folder to GitHub. Do not copy the Mac `.venv`; Windows uses `.venv-windows`.

Restart on Windows: the server certificate is regenerated when the computer IP changes. If the same certificate authority was transferred, the already trusted iPhones can continue using it. Otherwise install the new certificate.

## Backups and updates

Export a JSON backup from Stock. For a complete backup, stop the server and copy `data` to a safe private location. Private keys in that folder should never be shared publicly.

For updates: stop the server, back up `data`, extract the new source files into the application folder without replacing `data`, and rerun the installer before starting again. Local data is excluded from Git.

## Notes

- One record is one physical spool. Batch quantity creates separate records; scan-to-remove removes only the selected record after confirmation.
- New spools default to 1 kg. Low stock means 1–2 available spools per material/color; zero is out of stock.
- The initial offline catalogue covers six barcodes, not the full Bambu Lab range. Unknown products are learned after the first manual entry.
- All users able to access the app on the LAN can edit stock; this version has no accounts.
- Barcode libraries and their license notices are bundled in `static/vendor`. No cloud calls are made while scanning.
- Windows setup must be validated on the target PC; development was performed on macOS.

## Mac preview

`python3 server.py --http` serves only this computer at `http://127.0.0.1:8080`. `Lancer-Reseau-Mac.command` starts the HTTPS LAN server.
