import os
from urllib.parse import quote_plus

class Settings:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

    PGHOST = os.environ.get("PGHOST")
    PGPORT = os.environ.get("PGPORT", "5433")
    PGUSER = os.environ.get("PGUSER")
    PGPASSWORD = os.environ.get("PGPASSWORD")
    PGDATABASE = os.environ.get("PGDATABASE")
    PGSSLMODE = os.environ.get("PGSSLMODE", "")  # e.g. "require"

def _build_pg_url():
    if not (Settings.PGHOST and Settings.PGUSER and Settings.PGPASSWORD and Settings.PGDATABASE):
        return None
    pwd = quote_plus(Settings.PGPASSWORD)
    url = f"postgresql+psycopg://{Settings.PGUSER}:{pwd}@{Settings.PGHOST}:{Settings.PGPORT}/{Settings.PGDATABASE}"
    if Settings.PGSSLMODE:
        sep = "?" if "?" not in url else "&"
        url = f"{url}{sep}sslmode={Settings.PGSSLMODE}"
    return url

def db_uri():
    # 1) Full URL takes precedence
    if Settings.DATABASE_URL:
        return Settings.DATABASE_URL
    # 2) Build from PG* vars if available
    built = _build_pg_url()
    if built:
        return built
    # 3) Fallback to SQLite (no crash)
    os.makedirs("instance", exist_ok=True)
    return "sqlite:///instance/app.db"
