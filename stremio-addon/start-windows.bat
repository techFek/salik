@echo off
rem Salik for Stremio: starts the server and an https tunnel (two windows).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed: https://nodejs.org/ & pause & exit /b 1)
where ffmpeg >nul 2>nul || (echo FFmpeg is not installed: winget install Gyan.FFmpeg & pause & exit /b 1)
where cloudflared >nul 2>nul || (echo cloudflared is not installed: winget install Cloudflare.cloudflared & pause & exit /b 1)
if "%PORT%"=="" set PORT=7000
start "Salik server" cmd /k node server.js
start "Salik tunnel" cmd /k cloudflared tunnel --url http://localhost:%PORT%
echo In the tunnel window, open the https://...trycloudflare.com address + /configure
