import sys, pandas as pd, re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dateutil import parser as dtparser
from config import db_uri
from models import Base, Country, Province, District, Hospital, Facility, BudgetLine, Quarter, QuarterLine, FacilityLevelEnum, AccessLevelEnum, User
from sqlalchemy.orm import Session
from sqlalchemy import select

def get_or_create_country(sess, name, code):
    obj = sess.query(Country).filter_by(code=code).one_or_none()
    if obj:
        return obj
    obj = Country(name=name.strip(), code=code.strip())
    sess.add(obj)
    sess.flush()
    return obj


def get_or_create_province(sess, name, code, country_id):
    obj = sess.execute(
        select(Province).where(Province.code == code)
    ).scalar_one_or_none()
    if obj:
        return obj
    obj = Province(
        name=name.strip(),
        code=code.strip(),
        country_id=country_id,
    )
    sess.add(obj)
    sess.flush()
    return obj


def get_or_create_district(sess, name, code, province_id):
    obj = sess.execute(
        select(District).where(District.code == code)
    ).scalar_one_or_none()
    if obj:
        return obj
    obj = District(
        name=name.strip(),
        code=code.strip(),
        province_id=province_id,
    )
    sess.add(obj)
    sess.flush()
    return obj


def get_or_create_hospital(
    sess,
    name,
    code,
    level,
    province_id,
    district_id,
):
    obj = sess.execute(
        select(Hospital).where(Hospital.code == code)
    ).scalar_one_or_none()

    if obj:
        return obj

    obj = Hospital(
        name=name.strip(),
        code=code.strip(),
        level=FacilityLevelEnum(level),
        province_id=province_id,
        district_id=district_id,
    )
    sess.add(obj)
    sess.flush()
    return obj

def get_or_create_facility(
    sess,
    name,
    code,
    level,
    country_id,
    province_id,
    district_id,
    referral_hospital_id=None,
):
    code = code.strip()

    obj = sess.execute(
        select(Facility).where(Facility.code == code)
    ).scalar_one_or_none()

    if obj:
        return obj

    obj = Facility(
        name=name.strip(),
        code=code,
        level=FacilityLevelEnum(level),
        country_id=country_id,
        province_id=province_id,
        district_id=district_id,
        referral_hospital_id=referral_hospital_id,
    )

    sess.add(obj)
    sess.flush()   # ensures INSERT happens now

    return obj

"""
def get_or_create_facility(
    sess,
    name,
    code,
    level,
    country_id,
    province_id,
    district_id,
    referral_hospital_id=None,
):
    obj = sess.query(Facility).filter_by(code=code).one_or_none()
    if obj:
        return obj

    obj = Facility(
        name=name.strip(),
        code=code.strip(),
        level=FacilityLevelEnum(level),
        country_id=country_id,
        province_id=province_id,
        district_id=district_id,
        referral_hospital_id=referral_hospital_id,
    )
    sess.add(obj)
    sess.flush()
    return obj"""


def create_facility_user(sess: Session, facility: Facility) -> User:
    """
    Create a login user for a facility if it does not already exist.
    """
    username = username_from_facility(facility.name, facility.code)

    existing = sess.query(User).filter_by(username=username).one_or_none()
    if existing:
        return existing

    user = User(
        username=username,
        access_level=AccessLevelEnum.FACILITY,
        facility_id=facility.id,
    )
    user.set_password(facility.code)

    sess.add(user)
    sess.flush()  # assigns ID

    return user

def create_users_for_all_facilities(sess: Session) -> dict:
    """
    Creates login users for all facilities that do not yet have one.
    """
    facilities = sess.query(Facility).all()

    created = 0
    skipped = 0

    for facility in facilities:
        username = username_from_facility(facility.name, facility.code)

        exists = sess.query(User).filter_by(username=username).first()
        if exists:
            skipped += 1
            continue

        user = User(
            username=username,
            access_level=AccessLevelEnum.FACILITY,
            facility_id=facility.id,
        )
        user.set_password(facility.code)

        sess.add(user)
        created += 1

    sess.commit()

    return {
        "created": created,
        "skipped_existing": skipped,
        "total_facilities": len(facilities),
    }


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

def username_from_facility(name: str, code: str) -> str:
    """
    Takes first word of facility name + facility code
    Example: 'Kibagabaga Health Centre', 'KBG001'
    -> kibagabaga_KBG001
    """
    if not name or not code:
        raise ValueError("Facility name and code are required")

    first_word = name.strip().split()[0].lower()
    return f"{first_word}_{code.strip()}"


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_excel.py <workbook.xlsx>")
        sys.exit(1)
    main(sys.argv[1])
