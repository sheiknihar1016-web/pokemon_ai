@echo off
title Pushing to GitHub...
color 0A

set GIT=C:\Users\muthu\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe
set GCM=C:\Users\muthu\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\mingw64\bin\git-credential-manager.exe

echo ================================================
echo   SpeakUp AI - Pushing to GitHub
echo ================================================
echo.

echo [1/3] Configuring GitHub login...
%GIT% config credential.helper "%GCM%"

echo [2/3] A browser window will open - sign in to GitHub and click Authorize
echo.
echo Press any key to start the push...
pause

echo.
echo [3/3] Pushing to GitHub...
%GIT% push -u origin main

echo.
if %ERRORLEVEL% == 0 (
    color 0A
    echo ================================================
    echo   SUCCESS! Project pushed to GitHub!
    echo   https://github.com/sheiknihar1016-web/pokemon_ai
    echo ================================================
) else (
    color 0C
    echo ================================================
    echo   Push failed. Please sign in when browser opens.
    echo   Then run this file again.
    echo ================================================
)
echo.
pause
