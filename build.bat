@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SUBSCOPE - WINDOWS BUILD
set "NONINTERACTIVE=0"
if /I "%~1"=="--ci" set "NONINTERACTIVE=1"
if defined CI set "NONINTERACTIVE=1"
set "GOTOOLCHAIN=auto"

where node >nul 2>&1 || goto :missing_node
where npm >nul 2>&1 || goto :missing_node
where go >nul 2>&1 || goto :missing_go

 echo [1/8] Frontend packages
pushd frontend
if exist package-lock.json (
  call npm ci --no-audit --no-fund
) else (
  call npm install --no-audit --no-fund
)
if errorlevel 1 (popd & goto :fail)

 echo [2/8] JavaScript tests
call npm test
if errorlevel 1 (popd & goto :fail)

 echo [3/8] Svelte build
call npm run build
if errorlevel 1 (popd & goto :fail)
popd
if not exist "frontend\dist\index.html" goto :fail
if not exist "frontend\dist\modal.html" goto :fail

 echo [4/8] Bundle check
pushd frontend
call npm run check:assets
if errorlevel 1 (popd & goto :fail)
popd

 echo [5/8] Go dependencies
call go mod download
if errorlevel 1 goto :fail
call go mod tidy
if errorlevel 1 goto :fail

 echo [6/8] Native tests
call go test ./internal/netclient
if errorlevel 1 goto :fail

 echo [7/8] EXE icon resources
for /f "delims=" %%G in ('go env GOPATH') do set "PATH=%%G\bin;%PATH%"
where go-winres >nul 2>&1
if errorlevel 1 (
  call go install github.com/tc-hib/go-winres@v0.3.3
  if errorlevel 1 goto :fail
)
call go-winres simply --icon "build\appicon.png" --manifest gui --arch amd64 --out rsrc --file-description "Subscope Desktop" --product-name "Subscope" --file-version 2.9.1 --product-version 2.9.1
if errorlevel 1 goto :fail
if not exist "rsrc_windows_amd64.syso" goto :fail

 echo [8/8] Windows x64
where wails3 >nul 2>&1
if errorlevel 1 (
  call go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0
  if errorlevel 1 goto :fail
)
set "GOOS=windows"
set "GOARCH=amd64"
set "CGO_ENABLED=0"
if not exist bin mkdir bin
call wails3 build
if errorlevel 1 goto :fail
if not exist "bin\Subscope.exe" goto :fail

echo BUILD OK: bin\Subscope.exe
if "%NONINTERACTIVE%"=="0" pause
exit /b 0
:missing_node
echo NODE.JS REQUIRED
goto :fail
:missing_go
echo GO 1.26+ REQUIRED
goto :fail
:fail
echo BUILD FAILED
if "%NONINTERACTIVE%"=="0" pause
exit /b 1
