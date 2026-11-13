@echo off
cd /d "%~dp0"
chcp 65001 >nul
set /p URL=Paste a YouTube link (or a video file path): 
python salik_scan.py scan "%URL%"
pause
