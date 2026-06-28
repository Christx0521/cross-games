@echo off
chcp 65001 >nul
title Cross-Games - Lanzador
cd /d "%~dp0"

echo ============================================
echo   Cross-Games - iniciando servidor y web
echo ============================================
echo.

REM Instala dependencias la primera vez (si faltan)
if not exist "server\node_modules" (
  echo Instalando dependencias del servidor...
  pushd server && call npm install && popd
)
if not exist "web\node_modules" (
  echo Instalando dependencias de la web...
  pushd web && call npm install && popd
)

REM Crea los .env la primera vez (si faltan)
if not exist "server\.env" copy "server\.env.example" "server\.env" >nul
if not exist "web\.env" copy "web\.env.example" "web\.env" >nul

echo Abriendo dos ventanas (backend y frontend)...
start "Cross-Games Servidor" cmd /k "cd server && npm run dev"
start "Cross-Games Web" cmd /k "cd web && npm run dev"

echo Esperando a que arranquen...
timeout /t 7 >nul

start "" http://localhost:5173

echo.
echo Listo. Se abrio el navegador en http://localhost:5173
echo Para detener: cierra las dos ventanas "Servidor" y "Web".
echo Puedes cerrar esta ventana.
timeout /t 5 >nul
