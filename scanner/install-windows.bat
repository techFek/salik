@echo off
rem Salik Scan: one-time setup on Windows (Python, FFmpeg, Deno for YouTube, and the Python packages).
cd /d "%~dp0"
where python >nul 2>nul || winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
where ffmpeg >nul 2>nul || winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
where deno >nul 2>nul || winget install -e --id DenoLand.Deno --accept-package-agreements --accept-source-agreements
echo.
echo If Python, FFmpeg or Deno was just installed, close this window and run this file again.
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo Done. Run scan.bat and paste a YouTube link.
pause
