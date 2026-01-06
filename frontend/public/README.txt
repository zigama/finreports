Place your moh.svg logo in this folder (public/moh.svg).

CREATE DATABASE
===================

CREATE DATABASE financial_reporting;
CREATE ROLE rbc WITH LOGIN PASSWORD 'rbcP@ss';
GRANT ALL PRIVILEGES ON DATABASE financial_reporting TO rbc;

psql -hlocalhost -p5433 -Urbc -dfinancial_reporting -W
=======================================================
export FLASK_RUN_FROM_VENV=1
export LOCAL_PGHOST=localhost  # optional (default is localhost)

source venv/bin/activate
export FLASK_APP=app:create_app
flask db upgrade

If locally using Port 5433 instead of 5432
==================================
export DATABASE_URL="postgresql+psycopg://rbc:rbcP%40ss@localhost:5433/financial_reporting?sslmode=disable"
flask db upgrade

=====
Alembic
========
Option A (recommended): use Alembic directly (works with your current architecture)
1) Install alembic
source venv/bin/activate
pip install alembic

2) Initialize alembic once
alembic init migrations

3) Edit alembic.ini

Set this line (or leave it and do it in env.py):

sqlalchemy.url =

4) Update migrations/env.py to use your config + Base.metadata

Put this inside migrations/env.py:

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from config import db_uri
from models import Base

config = context.config
fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    url = db_uri()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = db_uri()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

5) Generate & upgrade
alembic revision --autogenerate -m "access scope auth"
alembic upgrade head


✅ This works perfectly with your current SQLAlchemy setup.



=======

 DROP TABLE activity              ;
 DROP TABLE activity_id_seq       ;
 DROP TABLE auth_user             ;
 DROP TABLE auth_user_id_seq      ;
 DROP TABLE budget_line           ;
 DROP TABLE budget_line_id_seq    ;
 DROP TABLE cashbook_entry        ;
 DROP TABLE cashbook_entry_id_seq ;
 DROP TABLE country               ;
 DROP TABLE country_id_seq        ;
 DROP TABLE district              ;
 DROP TABLE district_id_seq       ;
 DROP TABLE facility              ;
 DROP TABLE facility_id_seq       ;
 DROP TABLE hospital              ;
 DROP TABLE hospital_id_seq       ;
 DROP TABLE obligation            ;
 DROP TABLE obligation_id_seq     ;
 DROP TABLE province              ;
 DROP TABLE province_id_seq       ;
 DROP TABLE quarter               ;
 DROP TABLE quarter_id_seq        ;
 DROP TABLE quarter_line          ;
 DROP TABLE quarter_line_id_seq   ;
 DROP TABLE reallocation          ;
 DROP TABLE reallocation_id_seq   ;
 DROP TABLE redirection           ;
 DROP TABLE redirection_id_seq    ;
 DROP TABLE user                  ;
 DROP TABLE user_id_seq           ;
 DROP TABLE account         ;
 DROP TABLE activities      ;
 DROP TABLE budget_lines    ;
 DROP TABLE budgets         ;
 DROP TABLE cashbook        ;
 DROP TABLE country         ;
 DROP TABLE district        ;
 DROP TABLE facility        ;
 DROP TABLE hospital        ;
 DROP TABLE province        ;
 DROP TABLE token_blocklist ;
DROP TYPE IF EXISTS "facilitylevelenum" CASCADE;
DROP TYPE IF EXISTS "accesslevelenum" CASCADE;
DROP TYPE IF EXISTS "quarterenum" CASCADE;
DROP TYPE IF EXISTS "accounttypeenum" CASCADE;
DROP TYPE IF EXISTS "vatrequirementenum" CASCADE;
========================================
git init
git branch -M main
git remote add origin https://github.com/zigama/finreports.git

========================
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
.venv/
venv/
.env
.pytest_cache/
.mypy_cache/

# Node / React
node_modules/
npm-debug.log*
yarn.lock
dist/
build/

# OS
.DS_Store
EOF

==========================
git add .
git commit -m "Initialize finreports with cashbook & accounts fixes"

================


 1866  docker exec -it financial_reporting_api env | grep DATABASE_URL
 1867  docker ps -a
 1868  docker logs -f financial_reporting_db
 1869  docker exec -it financial_reporting_db psql -U rbc -d financial_reporting
 1870  git fetch
 1871  git pull
 1872  git fetch
 1873  git pull
 1874  docker exec -i financial_reporting_db   psql -U postgres < finrep.sql
 1875  docker exec -i financial_reporting_db   psql -U rbc < finrep.sql
 1876  docker exec -it financial_reporting_db   psql -U rbc -d financial_reporting -c "\dt"
 1877  docker exec -it financial_reporting_api env | grep DATABASE_URL

============
create admin
===========
export FLASK_APP=app:create_app
flask create_admin