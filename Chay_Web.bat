@echo off
title Du An 411 - Sunlit Ocean Date Planner
cd /d "%~dp0"
echo ========================================================
echo   DANG KHOI DONG DU AN 411 - A LITTLE ADVANTURE 
echo   Dia chi truy cap: http://localhost:3005
echo ========================================================
echo.
set PORT=3005
node src/server.js
pause
