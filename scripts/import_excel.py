import sys, pandas as pd, re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dateutil import parser as dtparser
from config import db_uri
from models import (Base, Province, District, Hospital, Facility, BudgetLine, Budget, Activity,
                    Quarter, QuarterLine, compute_budget_year, initials_from_name)
from datetime import datetime, date
from sqlalchemy import select
from decimal import Decimal

def first_non_empty(values):
    for v in values:
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None

def load_workbook(path:str):
    xls = pd.ExcelFile(path)
    return xls

def infer_header(xls, sheet_name):
    df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    # find first row that looks like a header (contains 'Subawardee' or 'SITE' etc.) for metadata
    meta = {}
    for i in range(min(6, len(df))):
        row = [str(x) if pd.notna(x) else "" for x in df.iloc[i].tolist()]
        line = " ".join(row)
        if "Subawardee" in line:
            meta["subawardee"] = first_non_empty(df.iloc[i,1:4].tolist())
        if "SITE" in line:
            meta["site"] = first_non_empty(df.iloc[i,1:4].tolist())
        if "Address" in line:
            meta["province"] = first_non_empty(df.iloc[i,2:5].tolist()) or first_non_empty(df.iloc[i,1:4].tolist())
        if "District" in line:
            meta["district"] = first_non_empty(df.iloc[i,0:5].tolist()[2:4])
        if "Quarter" in line and "Reporting period" in line:
            meta["reporting_period"] = line
    return meta

def import_basic_geo(session, meta):
    prov_name = meta.get("province") or "Unknown Province"
    dist_name = meta.get("district") or "Unknown District"
    site_name = meta.get("site") or "Unknown Facility"
    prov = session.query(Province).filter_by(name=prov_name).first()
    if not prov:
        prov = Province(name=prov_name); session.add(prov); session.flush()
    dist = session.query(District).filter_by(name=dist_name, province_id=prov.id).first()
    if not dist:
        dist = District(name=dist_name, province_id=prov.id); session.add(dist); session.flush()
    fac = session.query(Facility).filter_by(name=site_name, district_id=dist.id).first()
    if not fac:
        fac = Facility(name=site_name, province_id=prov.id, district_id=dist.id); session.add(fac); session.flush()
    return prov, dist, fac

def import_budget_lines(session, xls, fac_id:int):
    # Try to read "Y1 BUDGET FRW" if present
    if "Y1 BUDGET FRW" not in xls.sheet_names and "Y1_CS Budget_Frw" not in xls.sheet_names:
        return
    sheet = "Y1 BUDGET FRW" if "Y1 BUDGET FRW" in xls.sheet_names else "Y1_CS Budget_Frw"
    df = pd.read_excel(xls, sheet_name=sheet, header=None)
    # Find header row that contains 'COMPONENT' and 'Budget line item description'
    header_row_idx = None
    for i in range(0, min(30, len(df))):
        line = " ".join([str(x) for x in df.iloc[i].tolist()])
        if "Budget line item description" in line or "COMPONENT" in line:
            header_row_idx = i + 1  # next row often contains labels
            break
    if header_row_idx is None:
        return
    data = pd.read_excel(xls, sheet_name=sheet, header=header_row_idx)
    # Normalize columns
    cols = {c:str(c).strip().lower() for c in data.columns}
    data.columns = list(cols.values())
    for _, row in data.iterrows():
        desc = str(row.get("budget line item description", "")).strip()
        if not desc or desc.lower().startswith("total"):
            continue
        comp = str(row.get("component", "")).strip() or None
        code = str(row.get("budget line item code", "")).strip() or None
        unit = str(row.get("unit", "")).strip() or None
        unit_cost = row.get("unit cost")
        qty = row.get("quantity")
        total = row.get("total cost") or (unit_cost or 0) * (qty or 0)
        bl = BudgetLine(facility_id=fac_id, component=comp or None, code=code or None,
                        description=desc, unit=unit or None,
                        unit_cost=unit_cost if pd.notna(unit_cost) else None,
                        quantity=qty if pd.notna(qty) else None,
                        total_cost=total if pd.notna(total) else None)
        session.add(bl)
    session.flush()

def import_quarter(session, fac_id:int, xls, year:int=2024, quarter:int=1):
    meta = infer_header(xls, f"Summary report Q{quarter}") if f"Summary report Q{quarter}" in xls.sheet_names else {}
    q = Quarter(facility_id=fac_id, year=year, quarter=quarter, reporting_period=meta.get("reporting_period"))
    session.add(q); session.flush()

    # Quarter lines might be present as a small table in the summary sheet; this is highly variable.
    # We skip auto-creation here. Users can POST /quarter-lines later or extend mapping.

    return q

def import_budget_excel(
    sess,
    excel_path: str,
    start_date_str: str,
    end_date_str: str,
):

    # Parse dates
    start_date = parse_date(start_date_str)
    end_date = parse_date(end_date_str)

    budget_year = compute_budget_year(start_date, end_date)

    df = pd.read_excel(excel_path).fillna("")

    for _, row in df.iterrows():

        # ---- resolve facility ----
        facility = sess.execute(
            select(Facility)
            .where(Facility.name == clean_str(row["Site"]))
        ).scalar_one_or_none()

        if not facility:
            continue

        # ---- resolve hospital ----
        hospital = sess.execute(
            select(Hospital)
            .where(Hospital.name == clean_str(row["DH/Depart"]))
        ).scalar_one_or_none()

        # ---- budget line ----
        bl_name = clean_str(row["Budget Lines"])
        bl_code = initials_from_name(bl_name)

        budget_line = sess.execute(
            select(BudgetLine).where(BudgetLine.code == bl_code)
        ).scalar_one_or_none()

        if not budget_line:
            budget_line = BudgetLine(
                code=bl_code,
                name=bl_name,
            )
            sess.add(budget_line)
            sess.flush()

        # ---- activity ----
        act_name = clean_str(row["Activity"])
        act_code = initials_from_name(act_name)

        activity = sess.execute(
            select(Activity)
            .where(
                Activity.budget_line_id == budget_line.id,
                Activity.code == act_code,
            )
        ).scalar_one_or_none()

        if not activity:
            activity = Activity(
                budget_line_id=budget_line.id,
                code=act_code,
                name=act_name,
                description=clean_str(row["Activity  Description"]),
            )
            sess.add(activity)
            sess.flush()

        # ---- budget record ----
        budget = Budget(

            # NEW
            start_date=start_date,
            end_date=end_date,
            budget_year=budget_year,
            is_validated=False,

            facility_id=facility.id,
            hospital_id=hospital.id if hospital else None,

            budget_line_id=budget_line.id,
            activity_id=activity.id,

            level=clean_str(row["Level"]),

            estimated_number_quantity=clean_decimal(row["Estimated Number/ Quantity"]),
            estimated_frequency_occurrence=clean_decimal(row["Estimated Frequency /occurance"]),

            unit_price_usd=clean_decimal(row["Unit Price $"]),
            cost_per_unit_rwf=clean_decimal(row["Cost per Unit Frw"]),

            percent_effort_share=clean_percent(row["% of effort/ Share"]),

            component_1=clean_decimal(row["Component 1"]),
            component_2=clean_decimal(row["Component 2"]),
            component_3=clean_decimal(row["Component 3"]),
            component_4=clean_decimal(row["Component 4"]),
        )

        # Auto-check
        Budget.prepare_for_insert(budget)

        sess.add(budget)

    sess.commit()

def clean_str(v):
    return str(v).strip() if v not in (None, "", "nan") else None

def clean_decimal(v):
    if v in (None, "", "nan"):
        return None
    return Decimal(str(v).replace(",", ""))

def clean_percent(v):
    if not v:
        return None
    return float(str(v).replace("%", ""))
def parse_date(value: str) -> date:

    if not value:
        raise ValueError("Date is required")

    return datetime.strptime(value.strip(), "%d-%m-%Y").date()

def main(xlsx_path:str):
    engine = create_engine(db_uri(), future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    xls = load_workbook(xlsx_path)
    with Session() as session:
        # Use Q1 sheet to grab metadata (province, district, site)
        meta = {}
        for sn in xls.sheet_names:
            if "Summary report Q1" in sn:
                meta = infer_header(xls, sn); break
        if not meta:
            # fallback any summary sheet
            for sn in xls.sheet_names:
                if "Summary report" in sn:
                    meta = infer_header(xls, sn); break
        prov, dist, fac = import_basic_geo(session, meta)
        import_budget_lines(session, xls, fac.id)
        import_quarter(session, fac.id, xls, year=2024, quarter=1)
        session.commit()
        print(f"Imported facility '{fac.name}' in {prov.name} / {dist.name}.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_excel.py <workbook.xlsx>")
        sys.exit(1)
    main(sys.argv[1])
