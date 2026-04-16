@echo off
title Building Tavern Screen...
cd /d "%~dp0"
echo Installing dependencies...
call npm install
echo.
echo Building executable...
call npm run build
echo.
echo Done! Check the dist\ folder for the installer and portable exe.
pause
