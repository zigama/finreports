import os
from urllib.parse import quote_plus, urlparse, urlunparse


class Settings:
    # --- Flask / JWT ---
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret").strip()

    # Prefer a full SQLAlchemy URL if provided
    DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

    # --- PG* parts (optional) ---
    PGHOST = (os.environ.get("PGHOST") or "").strip()
    PGPORT = (os.environ.get("PGPORT") or "5432").strip()  # FIX: default 5432
    PGUSER = (os.environ.get("PGUSER") or "").strip()
    PGPASSWORD = os.environ.get("PGPASSWORD") or ""  # keep raw (can contain special chars)
    PGDATABASE = (os.environ.get("PGDATABASE") or "").strip()
    PGSSLMODE = (os.environ.get("PGSSLMODE") or "").strip()  # e.g. "require" / "disable"

    # If you run the backend locally (venv), your DB host must not be docker DNS.
    # We'll auto-switch "db"/"postgres" -> localhost when FLASK_RUN_FROM_VENV=1,
    # or when RUNNING_IN_DOCKER is not detected and host looks docker-ish.
    FLASK_RUN_FROM_VENV = (os.environ.get("FLASK_RUN_FROM_VENV") or "").strip() in ("1", "true", "True")
    LOCAL_PGHOST = (os.environ.get("LOCAL_PGHOST") or "localhost").strip()  # override if needed


def _is_running_in_docker() -> bool:
    # Common reliable heuristic
    if os.path.exists("/.dockerenv"):
        return True
    try:
        with open("/proc/1/cgroup", "rt") as f:
            txt = f.read()
        return ("docker" in txt) or ("containerd" in txt) or ("kubepods" in txt)
    except Exception:
        return False


def _maybe_fix_host_for_local(url: str) -> str:
    """
    If DATABASE_URL contains a docker-only hostname (e.g., db),
    and we are running locally (venv), replace it with localhost.
    """
    if not url:
        return url

    parsed = urlparse(url)
    host = parsed.hostname or ""

    # docker-compose service hostnames you might use
    dockerish_hosts = {"db", "postgres", "postgresql"}

    running_in_docker = _is_running_in_docker()
    force_local = Settings.FLASK_RUN_FROM_VENV

    if (force_local or not running_in_docker) and host in dockerish_hosts:
        # rebuild netloc preserving userinfo and port
        username = parsed.username or ""
        password = parsed.password or ""
        port = parsed.port

        userinfo = ""
        if username:
            userinfo = username
            if password is not None:
                userinfo += f":{quote_plus(password)}"
            userinfo += "@"

        new_netloc = f"{userinfo}{Settings.LOCAL_PGHOST}"
        if port:
            new_netloc += f":{port}"

        parsed = parsed._replace(netloc=new_netloc)
        return urlunparse(parsed)

    return url


def _build_pg_url() -> str | None:
    if not (Settings.PGHOST and Settings.PGUSER and Settings.PGDATABASE):
        return None

    host = Settings.PGHOST
    running_in_docker = _is_running_in_docker()

    # If user runs from venv, override docker hostnames automatically
    if (Settings.FLASK_RUN_FROM_VENV or not running_in_docker) and host in {"db", "postgres", "postgresql"}:
        host = Settings.LOCAL_PGHOST

    pwd = quote_plus(Settings.PGPASSWORD or "")
    url = f"postgresql+psycopg://{Settings.PGUSER}:{pwd}@{host}:{Settings.PGPORT}/{Settings.PGDATABASE}"

    if Settings.PGSSLMODE:
        sep = "?" if "?" not in url else "&"
        url = f"{url}{sep}sslmode={Settings.PGSSLMODE}"

    return url


def db_uri() -> str:
    # 1) Full URL takes precedence (but fix docker host when running locally)
    if Settings.DATABASE_URL:
        return _maybe_fix_host_for_local(Settings.DATABASE_URL)

    # 2) Build from PG* vars if available
    built = _build_pg_url()
    if built:
        return built

    # 3) Fallback to SQLite (no crash)
    os.makedirs("instance", exist_ok=True)
    return "sqlite:///instance/app.db"
