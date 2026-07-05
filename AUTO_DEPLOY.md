# Автоматический деплой через GitHub Actions

После настройки каждый push в ветку `main` будет автоматически обновлять сервер Timeweb `85.92.111.202`.

Workflow уже лежит в репозитории: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)

## 1. Создать GitHub-репозиторий

Создайте пустой приватный репозиторий, например:

```text
retro-pressa-dashboard
```

## 2. Подготовить SSH-ключ для GitHub Actions

На Mac:

```bash
ssh-keygen -t ed25519 -C "github-actions-retro-pressa" -f ~/.ssh/retro_pressa_deploy
```

Скопировать публичный ключ на сервер:

```bash
ssh-copy-id -i ~/.ssh/retro_pressa_deploy.pub root@85.92.111.202
```

Если `ssh-copy-id` недоступен:

```bash
cat ~/.ssh/retro_pressa_deploy.pub
```

Скопируйте вывод и добавьте его на сервер в файл:

```bash
nano ~/.ssh/authorized_keys
```

## 3. Добавить секреты в GitHub

В GitHub-репозитории откройте:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Добавьте:

```text
DEPLOY_HOST=85.92.111.202
DEPLOY_USER=root
DEPLOY_SSH_KEY=<содержимое файла ~/.ssh/retro_pressa_deploy>
BITRIX_WEBHOOK_URL=...
GOOGLE_SERVICE_ACCOUNT_JSON=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_TRAFFIC_CSV_URL=...
GOOGLE_TRAFFIC_SHEET_ID=...
GOOGLE_TRAFFIC_SHEET_NAME=...
GOOGLE_SHEET_ID=...
```

Если нужен анализ переписок через Gemini, добавьте ещё:

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Содержимое приватного ключа посмотреть так:

```bash
cat ~/.ssh/retro_pressa_deploy
```

Ключ начинается с:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
```

и заканчивается:

```text
-----END OPENSSH PRIVATE KEY-----
```

## 4. Первый push

В папке проекта:

```bash
git init
git add .
git commit -m "Initial Retro Pressa dashboard"
git branch -M main
git remote add origin <URL вашего GitHub-репозитория>
git push -u origin main
```

После push откройте вкладку GitHub:

```text
Actions -> Deploy Retro Pressa
```

Если workflow зелёный, сервер обновлён.

## 5. Проверка

Откройте:

```text
http://85.92.111.202:4174
```

На сервере можно проверить процесс:

```bash
pm2 status
pm2 logs retro-pressa --lines 30
```

## Что важно в текущей версии

- Деплой сохраняет локальные snapshot-файлы Bitrix и Google между выкладками.
- Слепки лежат на сервере в общей папке и не стираются при очередном `push`.
- Если нужен полный пересчёт, можно просто удалить содержимое `data/bitrix-snapshots` или `data/google-snapshots` на сервере и сделать новый деплой.
