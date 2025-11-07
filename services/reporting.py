from sqlalchemy.orm import Session
from sqlalchemy import func, select
from models import Facility, Quarter, QuarterLine, CashbookEntry, Obligation, BudgetLine, Reallocation, Redirection

def header(db: Session, facility_id:int, year:int, quarter:int):
    fac = db.get(Facility, facility_id)
    q = db.execute(select(Quarter).where(Quarter.facility_id==facility_id, Quarter.year==year, Quarter.quarter==quarter)).scalars().first()
    return {
        "facility": fac.name if fac else None,
        "province": fac.province.name if fac and fac.province else None,
        "district": fac.district.name if fac and fac.district else None,
        "year": year, "quarter": quarter,
        "reporting_period": q.reporting_period if q else None
    }

def money(x): 
    return float(x) if x is not None else 0.0

def build_summary_report(db: Session, facility_id:int, year:int, quarter:int):
    head = header(db, facility_id, year, quarter)
    qlines = db.execute(select(QuarterLine, BudgetLine).join(BudgetLine, QuarterLine.budget_line_id==BudgetLine.id, isouter=True).where(QuarterLine.quarter_id.in_(
        select(Quarter.id).where(Quarter.facility_id==facility_id, Quarter.year==year, Quarter.quarter==quarter)
    ))).all()

    rows = []
    total_planned = total_actual = 0.0
    for ql, bl in qlines:
        planned = money(ql.planned); actual = money(ql.actual)
        variance = planned - actual if ql.variance is None else money(ql.variance)
        rows.append({
            "component": bl.component if bl else None,
            "budget_line_code": bl.code if bl else None,
            "description": bl.description if bl else None,
            "planned": planned, "actual": actual, "variance": variance,
            "comments": ql.comments
        })
        total_planned += planned; total_actual += actual

    return {
        "header": head,
        "lines": rows,
        "totals": {
            "planned": total_planned,
            "actual": total_actual,
            "variance": total_planned - total_actual
        }
    }

def build_statement_report(db: Session, facility_id:int, year:int, quarter:int):
    head = header(db, facility_id, year, quarter)
    inflow = db.execute(select(func.sum(CashbookEntry.inflow)).where(CashbookEntry.facility_id==facility_id, CashbookEntry.year==year, CashbookEntry.quarter==quarter)).scalar() or 0
    outflow = db.execute(select(func.sum(CashbookEntry.outflow)).where(CashbookEntry.facility_id==facility_id, CashbookEntry.year==year, CashbookEntry.quarter==quarter)).scalar() or 0
    obligations = db.execute(select(func.sum(Obligation.amount)).where(Obligation.facility_id==facility_id, Obligation.year==year, Obligation.quarter==quarter)).scalar() or 0
    return {
        "header": head,
        "revenue": float(inflow),
        "expenditure": float(outflow),
        "obligations": float(obligations),
        "net": float(inflow) - float(outflow)
    }

def build_bank_recon(db: Session, facility_id:int, year:int, quarter:int):
    head = header(db, facility_id, year, quarter)
    # naive example: opening = first balance before quarter; closing = last balance in quarter
    q = db.execute(select(CashbookEntry).where(CashbookEntry.facility_id==facility_id, CashbookEntry.year==year, CashbookEntry.quarter==quarter).order_by(CashbookEntry.txn_date.asc())).scalars().all()
    opening = float(q[0].balance) if q else 0.0
    closing = float(q[-1].balance) if q else 0.0
    return {
        "header": head,
        "opening_balance": opening,
        "closing_balance": closing,
        "movements": [{
            "date": e.txn_date.isoformat(), "ref": e.reference, "desc": e.description,
            "in": float(e.inflow or 0), "out": float(e.outflow or 0), "balance": float(e.balance or 0)
        } for e in q]
    }

def build_hrh_report(db: Session, facility_id:int, year:int, quarter:int):
    head = header(db, facility_id, year, quarter)
    # Placeholder: actual HRH fields depend on your workbook column mapping.
    # Return a shell object so the endpoint exists.
    return {
        "header": head,
        "positions": [],
        "totals": {"planned": 0.0, "actual": 0.0}
    }

def build_reallocation_report(db: Session, facility_id:int, year:int, quarter:int):
    head = header(db, facility_id, year, quarter)
    reallocs = db.execute(select(Reallocation).where(Reallocation.facility_id==facility_id)).scalars().all()
    redirects = db.execute(select(Redirection).where(Redirection.facility_id==facility_id)).scalars().all()
    return {
        "header": head,
        "reallocations": [{
            "date": r.date.isoformat() if r.date else None,
            "from_budget_line_id": r.from_budget_line_id,
            "to_budget_line_id": r.to_budget_line_id,
            "amount": float(r.amount or 0),
            "reason": r.reason
        } for r in reallocs],
        "redirections": [{
            "date": r.date.isoformat() if r.date else None,
            "from_component": r.from_component,
            "to_component": r.to_component,
            "amount": float(r.amount or 0),
            "reason": r.reason
        } for r in redirects]
    }
