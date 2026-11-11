# SUBSCOPE

Анализатор Xray-подписок для Windows. Windows 10/11.

## Возможности

- Xray JSON · URI · Base64 · файлы · URL.
- VLESS · VMess · Trojan · Shadowsocks · Hysteria 2.
- Нативный HTTP · Happ Headers · индивидуальный X-Hwid.
- DNS · IPv4/IPv6 · GEO · ASN · BGP.
- Анализ уникальности · 26 сигналов · индекс 0–100.
- Сравнение A/B · совпадения и различия.
- Реестр · фильтры · контекстное меню · копирование конфигов.
- 11 графиков · статистика · подсказки.
- История проверок · повторная проверка.
- Экспорт JSON · CSV.
- Тёмная / светлая тема · акценты.
- Отдельное окно узла · frameless · изменение размера.

## Требования

| Компонент | Версия |
| --- | --- |
| Windows | 10 / 11 x64 |
| Go | 1.26+ |
| Node.js | 22+ |
| WebView2 | Runtime |

## Сборка

```bat
build.bat
```

Результат: `bin\Subscope.exe`.

## Ручная сборка

```bat
cd frontend
npm install
npm test
npm run build
npm run check:assets
cd ..
go mod download
go test ./internal/netclient
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0
REM EXE + ICON: build.bat
wails3 build
```

Иконка Windows: `build/appicon.png` · `build/icon.ico`. `build.bat` генерирует ресурс EXE.

## GitHub Releases

```bash
git add .
git commit -m "Release 2.9.2"
git push origin main
git tag v2.9.2
git push origin v2.9.2
```

- Workflow: `.github/workflows/release.yml`.
- Триггер: `v*`.
- Платформа: Windows x64.
- Сборка: `build.bat --ci`.
- Файлы: `Subscope.exe`, `Subscope-windows-x64.zip`, `SHA256SUMS.txt`.
- Повторный запуск: обновление файлов Release.
- Запуск: только push тега `v*`.
- Push в ветки / Pull Request: без Actions.
- Архив: EXE + присутствующие `.md`, `LICENSE`, `COPYING`, `NOTICE`.
- Отсутствие документации не прерывает сборку.
- Описание релиза: GitHub auto notes.


## Удаление старого CI

```bash
git rm --ignore-unmatch .github/workflows/ci.yml
git add -A
```

## Зависимости

- `frontend/package.json` · фиксированные версии.
- `frontend/package-lock.json` · создаётся при первом `npm install`, включать в Git.
- `go.sum` · создаётся при первой загрузке Go-модулей, включать в Git.

## Сеть

- Интерфейс: локальные JS/CSS и системный моноширинный шрифт; CDN нет.
- Сборка: зависимости npm и Go.
- Анализ URL, DNS и GEO/BGP: сетевые запросы.

## Лицензия

MIT · [LICENSE](LICENSE).
