@echo off
cd /d "%~dp0"
chcp 65001 >nul
python salik_scan.py train
pause
