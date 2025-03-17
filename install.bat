@echo off
echo ========================================
echo       Запуск установки...
echo ========================================
echo.

echo Шаг 1: Устанавливается менеджер fnm с помощью winget...
winget install Schniz.fnm
if %errorlevel% neq 0 (
    echo Ошибка при установке fnm. Проверьте соединение и права администратора.
    pause
    exit /b 1
)
echo.

echo Шаг 2: Устанавливается Node.js (версия 22) через fnm...
fnm install 22
if %errorlevel% neq 0 (
    echo Ошибка при установке Node.js.
    pause
    exit /b 1
)
echo.

echo Шаг 3: Проверка установки Node.js...
node -v
echo.
echo Проверьте, что вывод начинается с "22". Если да, установка прошла успешно.
echo.

echo Завершение установки. Терминал закроется через 5 секунд...
timeout /t 5 /nobreak >nul
