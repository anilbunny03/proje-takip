@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Proje Takip Uygulaması
echo.
echo ===============================================
echo   Proje Takip Uygulaması - Başlatıcı
echo ===============================================
echo.

set "PYCMD="
py -3 --version >nul 2>nul && set "PYCMD=py -3"
if not defined PYCMD python --version >nul 2>nul && set "PYCMD=python"
if not defined PYCMD goto nopython

echo Yerel sunucu başlatılıyor: http://localhost:8000/
echo Tarayıcı varsayılan tarayıcınızda açılacak.
echo Durdurmak için bu pencereyi kapatın veya Ctrl+C tuşlarına basın.
echo.
%PYCMD% serve.py --open
if errorlevel 1 goto fail
exit /b 0

:nopython
echo [HATA] Python bulunamadı.
echo Lütfen Python 3 yükleyin: https://www.python.org/downloads/
echo Kurulumda "Add python.exe to PATH" seçeneğini işaretleyin.
echo.
pause
exit /b 1

:fail
echo.
echo [HATA] Sunucu başlatılamadı. Yukarıdaki mesaja bakın.
pause
exit /b 1
