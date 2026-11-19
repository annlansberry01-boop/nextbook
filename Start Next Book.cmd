@echo off
rem Double-click to run Next Book on this laptop. Close this window to stop it.
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo Starting Next Book...
echo Open the "Local" address on this laptop, or the "Network" address on your phone (same wifi).
echo.
start "" http://localhost:5173
npm run dev
pause
