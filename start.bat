@echo off
title WhatsApp Agent
echo ==========================================
echo    WhatsApp Agent - Demarrage
echo ==========================================
echo.

:: Verifier si node_modules existe
if not exist "node_modules" (
    echo [1/2] Installation des dependances...
    call npm install
    echo.
)

echo [2/2] Demarrage du serveur Next.js...
echo.
echo    Interface: http://localhost:3000
echo    Ctrl+C pour arreter
echo.
echo ==========================================
echo.

call npm run dev
