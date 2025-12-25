## Планер бюджета — Django + React прототип

### Запуск backend (локально)

```bash
cd "планер бюджета"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python3 backend/manage.py migrate
python3 backend/manage.py createsuperuser
python3 backend/manage.py runserver
```

API будет доступен по адресу `http://127.0.0.1:8000/api/`.

### Запуск frontend (локально)

```bash
cd "планер бюджета/frontend"
npm install
npm run dev
```

Клиент откроется по адресу `http://127.0.0.1:3000`, запросы к `/api/*` будут проксированы на Django.

### Docker

```bash
cd "планер бюджета"
docker compose up --build
```

После сборки backend будет доступен на `http://127.0.0.1:8000`, frontend — на `http://127.0.0.1:3000`.


