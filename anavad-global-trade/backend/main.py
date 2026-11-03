"""Anavad Global Trade - FastAPI backend.

Run:  uvicorn main:app --reload      (from the backend/ folder)
Site: http://127.0.0.1:8000     API docs: http://127.0.0.1:8000/docs
"""
import os
import re
import sqlite3
import time
from collections import defaultdict
from contextlib import closing
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
DB_PATH = BASE_DIR / "inquiries.db"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me-now")  # set a real token in production

app = FastAPI(title="Anavad Global Trade API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

PRODUCTS = [
    {"id": "spices", "name": "Spices & Herbs", "direction": "Export", "icon": "bi-flower2",
     "items": ["Turmeric", "Cumin", "Red chilli", "Cardamom", "Black pepper"],
     "note": "Whole and ground, lab-tested for moisture and purity."},
    {"id": "grains", "name": "Rice, Pulses & Grains", "direction": "Export", "icon": "bi-basket3",
     "items": ["Basmati rice", "Non-basmati rice", "Lentils", "Chickpeas", "Wheat"],
     "note": "Bulk and private-label packing from 1 kg to 50 kg."},
    {"id": "textiles", "name": "Textiles & Apparel", "direction": "Export", "icon": "bi-layers",
     "items": ["Cotton fabrics", "Home textiles", "Garments", "Yarn"],
     "note": "OEKO-TEX and GOTS certified mills on request."},
    {"id": "handicrafts", "name": "Handicrafts & Home Decor", "direction": "Export", "icon": "bi-palette2",
     "items": ["Brass and metal ware", "Wood crafts", "Ceramics", "Rugs"],
     "note": "Export-grade packing for fragile goods."},
    {"id": "agri", "name": "Fresh & Processed Food", "direction": "Export", "icon": "bi-apple",
     "items": ["Mangoes", "Onions", "Frozen vegetables", "Pickles and sauces"],
     "note": "Cold-chain handling and phytosanitary documents."},
    {"id": "engineering", "name": "Engineering Goods", "direction": "Export", "icon": "bi-gear-wide-connected",
     "items": ["Auto components", "Fasteners", "Castings", "Hand tools"],
     "note": "Built to your drawings, with inspection reports."},
    {"id": "electronics", "name": "Electronics & Components", "direction": "Import", "icon": "bi-cpu",
     "items": ["Consumer electronics", "LED lighting", "Components"],
     "note": "Sourced from audited manufacturers, customs-cleared to your door."},
    {"id": "machinery", "name": "Machinery & Spare Parts", "direction": "Import", "icon": "bi-tools",
     "items": ["Packaging machines", "Food processing", "Spare parts"],
     "note": "Supplier verification and pre-shipment inspection."},
]


# ---------- database ----------
def db():
    return sqlite3.connect(DB_PATH)


def init_db():
    with closing(db()) as con:
        con.execute(
            """CREATE TABLE IF NOT EXISTS inquiries(
               id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
               name TEXT, email TEXT, phone TEXT, company TEXT, country TEXT,
               product TEXT, quantity TEXT, message TEXT)"""
        )
        con.commit()


init_db()


# ---------- models ----------
class Inquiry(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    phone: str = Field(default="", max_length=30)
    company: str = Field(default="", max_length=120)
    country: str = Field(min_length=2, max_length=60)
    product: str = Field(min_length=2, max_length=80)
    quantity: str = Field(default="", max_length=60)
    message: str = Field(min_length=10, max_length=2000)

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]{2,}", v):
            raise ValueError("Enter a valid email address")
        return v.strip().lower()


# ---------- tiny rate limiter (5 inquiries / 10 min / IP) ----------
_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    _hits[ip] = [t for t in _hits[ip] if now - t < 600]
    if len(_hits[ip]) >= 5:
        raise HTTPException(429, "Too many requests. Please try again in a few minutes.")
    _hits[ip].append(now)


# ---------- routes ----------
@app.get("/api/health")
def health():
    return {"status": "ok", "company": "Anavad Global Trade"}


@app.get("/api/products")
def products():
    return PRODUCTS


@app.post("/api/inquiry", status_code=201, dependencies=[Depends(rate_limit)])
def create_inquiry(data: Inquiry):
    with closing(db()) as con:
        cur = con.execute(
            "INSERT INTO inquiries(name,email,phone,company,country,product,quantity,message)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (data.name, data.email, data.phone, data.company, data.country,
             data.product, data.quantity, data.message),
        )
        con.commit()
    # TODO: send an email / WhatsApp notification here (smtplib, SendGrid, etc.)
    return {"ok": True, "reference": f"AGT-{cur.lastrowid:05d}",
            "message": "Thank you. Our team will reply within 24 hours."}


@app.get("/api/inquiries")
def list_inquiries(x_admin_token: str = Header(default="")):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(401, "Invalid admin token")
    with closing(db()) as con:
        con.row_factory = sqlite3.Row
        rows = con.execute("SELECT * FROM inquiries ORDER BY id DESC LIMIT 200").fetchall()
    return [dict(r) for r in rows]


# Serve the website (must be last)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="site")
