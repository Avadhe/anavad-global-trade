# Anavad Global Trade - Website

Stack: HTML, CSS, JavaScript, Bootstrap 5 (frontend) and Python FastAPI (backend, SQLite).

## Run locally
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Open http://127.0.0.1:8000  (API docs: http://127.0.0.1:8000/docs)

## View enquiries
```bash
curl -H "X-Admin-Token: change-me-now" http://127.0.0.1:8000/api/inquiries
```
Set your own token first: `export ADMIN_TOKEN="a-long-random-string"` (Windows: `set ADMIN_TOKEN=...`).

## Before going live - replace placeholders
- Email, phone, WhatsApp number and office address in `frontend/index.html`
- Founder roles and bios in the Team section
- Add your IEC / GST numbers in the footer once registered
- Add real certificates, client logos and product photos in `frontend/img/`
- Add email notification where `TODO` appears in `backend/main.py`
- Restrict `ALLOWED_ORIGINS` and set `ADMIN_TOKEN` as environment variables

## Deploy
Any VPS or Render / Railway: `uvicorn main:app --host 0.0.0.0 --port 8000` behind Nginx with HTTPS.
