import os
from pathlib import Path

from sqlalchemy import create_engine
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("PG_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL (or PG_URL) is not set in .env")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Dependency — gives a DB session to each request, closes it after
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()