# Health Facility Quarterly Reporting API (Flask)

This API records facilities, budget lines, activities, cashbook/obligations, reallocations/redirections, and produces the same classes of **quarterly** reports as in the Excel workbook _Y1 Q1 KAGEYO Fin report.xlsx_.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Initialize the database (SQLite by default)
export FLASK_APP=app:create_app
flask db_init

# (Optional) Import your Excel sample to populate reference data and an example report
python scripts/import_excel.py "/mnt/data/Y1 Q1 KAGEYO Fin report.xlsx"

# Run the API
flask run -p 5050
```

By default, the app uses SQLite (`instance/app.db`). Set `DATABASE_URL` for Postgres/MySQL if desired.

## Endpoints (high‑level)

- **Admin/Geo**
  - `POST/GET /provinces`, `/districts`, `/facilities`
- **Budget/Activities**
  - `POST/GET /budget-lines`, `/activities`
- **Execution**
  - `POST/GET /cashbook`, `/obligations`
- **Adjustments**
  - `POST/GET /reallocations`, `/redirections`
- **Quarterly reporting**
  - `POST/GET /quarters` (create a quarter report shell for a facility & period)
  - `POST/GET /quarter-lines` (per budget line planned/actual/variance/comments)
- **Reports** (JSON & CSV; Excel export stub provided)
  - `/reports/summary?facility_id=&year=&quarter=`
  - `/reports/statement?facility_id=&year=&quarter=`
  - `/reports/bank-recon?facility_id=&year=&quarter=`
  - `/reports/hrh?facility_id=&year=&quarter=`
  - `/reports/reallocation?facility_id=&year=&quarter=`

See `schemas.py` for payloads and `app.py` for routes.

## Mapping to the Excel Workbook

- **Summary report Q-3** → `/reports/summary`
- **Statement of rev & Exp** → `/reports/statement`
- **Bank reconciliation** → `/reports/bank-recon`
- **HRH REPORT** → `/reports/hrh`
- **Reallocation & redirection** → `/reports/reallocation`
- **Cashbook** → `/cashbook` (raw ledger entries)
- **Obligations** → `/obligations`
- **Y1 BUDGET FRW / Y1_CS Budget_Frw** → `/budget-lines` & `/activities`

The importer (`scripts/import_excel.py`) reads headers and rows heuristically from your workbook to prefill Provinces, Districts, Facility, Budget Lines, and creates an example Quarter (Q1) with lines if data can be inferred.

## Notes

- For production: put behind a gateway, add JWT auth, role-based permissions, and move to Postgres. You can also plug in Alembic migrations (a baseline command is provided).
- This is a **starter** with clear models and reports parity; adapt columns/codes to your canonical chart of accounts.
