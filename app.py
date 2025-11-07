import os
from flask import Flask, jsonify, request
from flask_smorest import Api, Blueprint  # smorest Blueprint
from flask_cors import CORS
from sqlalchemy import create_engine, func, cast, Numeric, Float, Text, select  # at top if not present
from sqlalchemy.orm import scoped_session, sessionmaker
from config import db_uri
from models import (
    Base, Country, Province, District, Hospital, Facility, BudgetLine, Activity, Budget,
    Quarter, QuarterLine, CashbookEntry, Obligation,
    Reallocation, Redirection, User, Cashbook, Account
)
from schemas import *
from services.reporting import (
    build_summary_report, build_statement_report,
    build_bank_recon, build_hrh_report, build_reallocation_report
)
from auth import blp_auth, init_jwt
from flask_jwt_extended import jwt_required
from contextlib import contextmanager


SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False))

@contextmanager
def get_session():
    """Yield a session with commit/rollback/close handled for you."""
    sess = SessionLocal()
    try:
        yield sess
        sess.commit()
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()

def create_app():
    app = Flask(__name__)

    # --- KEYS MUST EXIST BEFORE init_jwt(app) ---
    app.config.setdefault("SECRET_KEY", os.environ.get("SECRET_KEY", "dev-secret-change-me"))
    app.config.setdefault("JWT_SECRET_KEY", os.environ.get("JWT_SECRET_KEY", app.config["SECRET_KEY"]))
    # --------------------------------------------

    app.config.update({
        "API_TITLE": "Financial Quarterly Reporting API",
        "API_VERSION": "v1",
        "OPENAPI_VERSION": "3.0.3",
        "OPENAPI_URL_PREFIX": "/",
        "OPENAPI_SWAGGER_UI_PATH": "/docs",
        "API_SPEC_OPTIONS": {
            "components": {
                "securitySchemes": {
                    "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
                }
            },
            "security": [{"bearerAuth": []}],
        },
    })

    # Allow React dev origin; include Authorization/Content-Type headers
    CORS(
        app,
        resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    )

    api = Api(app)

    # DB
    engine = create_engine(db_uri(), future=True)
    SessionLocal.configure(bind=engine)
    Base.metadata.create_all(engine)
    app.session_factory = SessionLocal

    # JWT (keys already present in app.config)
    init_jwt(app)

    # ---- CLI helpers ----
    @app.cli.command("db_init")
    def db_init():
        Base.metadata.create_all(engine)
        print("Database initialized.")

    @app.cli.command("create_admin")
    def create_admin():
        username = os.environ.get("ADMIN_USERNAME", "admin")
        password = os.environ.get("ADMIN_PASSWORD", "admin123")
        with SessionLocal() as db:
            u = db.query(User).filter_by(username=username).first()
            if not u:
                u = User(username=username, role="admin")
                u.set_password(password)
                db.add(u); db.commit()
                print(f"Created admin user '{username}'.")
            else:
                print(f"User '{username}' already exists.")

    # ---- Blueprints (smorest) ----
    blp_geo = Blueprint("geo", __name__, url_prefix="/")
    blp_budget = Blueprint("budget", __name__, url_prefix="/")
    blp_cashbook = Blueprint("cashbook", __name__, url_prefix="/")
    blp_exec = Blueprint("exec", __name__, url_prefix="/")
    blp_report = Blueprint("report", __name__, url_prefix="/reports")

    create_schema = CashbookCreateSchema()
    update_schema = CashbookUpdateSchema()
    read_schema = CashbookReadSchema()
    read_many_schema = CashbookReadSchema(many=True)
    account_schema = AccountSchema()
    account_many_schema = AccountSchema(many=True)
    read_account_schema = AccountReadSchema()
    read_account_many_schema = AccountReadSchema(many=True)
    create_account_schema = AccountCreateSchema()
    update_account_schema = AccountUpdateSchema()

    def _balance_subq():
        # sum(cash_in - cash_out) per account
        return (
            select(func.coalesce(func.sum((Cashbook.cash_in or 0) - (Cashbook.cash_out or 0)), 0))
            .where(Cashbook.account_id == Account.id)
            .correlate(Account)
            .scalar_subquery()
        )

    # ---------- Geo ----------
    # --- Catalog: Countries ---
    @blp_geo.route("/countries", methods=["GET", "POST"])
    @jwt_required()
    def countries():
        with SessionLocal() as db:
            if request.method == "POST":
                data = CountrySchema().load(request.json)
                obj = Country(**data);
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return CountrySchema().dump(obj), 201
            items = db.query(Country).order_by(Country.name.asc()).all()
            return CountrySchema(many=True).dump(items)

    # Provinces (filter by country_id)
    @blp_geo.route("/provinces", methods=["GET", "POST"])
    @jwt_required()
    def provinces():
        with SessionLocal() as db:
            if request.method == "POST":
                data = ProvinceSchema().load(request.json)
                obj = Province(**data);
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return ProvinceSchema().dump(obj), 201
            q = db.query(Province)
            country_id = request.args.get("country_id", type=int)
            if country_id: q = q.filter(Province.country_id == country_id)
            return ProvinceSchema(many=True).dump(q.order_by(Province.name.asc()).all())

    # Districts (filter by province_id)
    @blp_geo.route("/districts", methods=["GET", "POST"])
    @jwt_required()
    def districts():
        with SessionLocal() as db:
            if request.method == "POST":
                data = DistrictSchema().load(request.json)
                obj = District(**data);
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return DistrictSchema().dump(obj), 201
            q = db.query(District)
            province_id = request.args.get("province_id", type=int)
            if province_id: q = q.filter(District.province_id == province_id)
            return DistrictSchema(many=True).dump(q.order_by(District.name.asc()).all())

    # Hospitals (filter by province_id / district_id)
    @blp_geo.route("/hospitals", methods=["GET", "POST"])
    @jwt_required()
    def hospitals():
        with SessionLocal() as db:
            if request.method == "POST":
                data = HospitalSchema().load(request.json)
                obj = Hospital(**data);
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return HospitalSchema().dump(obj), 201
            q = db.query(Hospital)
            province_id = request.args.get("province_id", type=int)
            district_id = request.args.get("district_id", type=int)
            if province_id: q = q.filter(Hospital.province_id == province_id)
            if district_id: q = q.filter(Hospital.district_id == district_id)
            return HospitalSchema(many=True).dump(q.order_by(Hospital.name.asc()).all())

    # Facilities (filter by country/province/district/referral_hospital)
    @blp_geo.route("/facilities", methods=["GET", "POST"])
    @jwt_required()
    def facilities():
        with SessionLocal() as db:
            if request.method == "POST":
                data = FacilitySchema().load(request.json)
                obj = Facility(**data);
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return FacilitySchema().dump(obj), 201
            q = db.query(Facility)
            country_id = request.args.get("country_id", type=int)
            province_id = request.args.get("province_id", type=int)
            district_id = request.args.get("district_id", type=int)
            ref_id = request.args.get("referral_hospital_id", type=int)
            if country_id: q = q.filter(Facility.country_id == country_id)
            if province_id: q = q.filter(Facility.province_id == province_id)
            if district_id: q = q.filter(Facility.district_id == district_id)
            if ref_id: q = q.filter(Facility.referral_hospital_id == ref_id)
            return FacilitySchema(many=True).dump(q.order_by(Facility.name.asc()).all())


    # ---------- BudgetLine ----------
    @blp_budget.route("/budget-lines", methods=["GET", "POST"])
    @jwt_required()
    def budget_lines():
        with app.session_factory() as db:
            if request.method == "POST":
                payload = BudgetLineSchema().load(request.json)
                obj = BudgetLine(**payload)
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return BudgetLineSchema().dump(obj), 201

            q = db.query(BudgetLine)
            search = request.args.get("q")
            if search:
                q = q.filter(BudgetLine.name.ilike(f"%{search}%") | BudgetLine.code.ilike(f"%{search}%"))
            return BudgetLineSchema(many=True).dump(q.order_by(BudgetLine.code.asc()).all())

    # ---------- Activity ----------
    @blp_budget.route("/activities", methods=["GET", "POST"])
    @jwt_required()
    def activities():
        with app.session_factory() as db:
            if request.method == "POST":
                payload = ActivitySchema().load(request.json)
                # sanity: budget line must exist
                bl = db.query(BudgetLine).get(payload["budget_line_id"])
                if not bl:
                    return {"message": "budget_line_id not found"}, 400
                obj = Activity(**payload)
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return ActivitySchema().dump(obj), 201

            q = db.query(Activity)
            budget_line_id = request.args.get("budget_line_id", type=int)
            search = request.args.get("q")
            if budget_line_id:
                q = q.filter(Activity.budget_line_id == budget_line_id)
            if search:
                q = q.filter(Activity.name.ilike(f"%{search}%") | Activity.code.ilike(f"%{search}%"))
            return ActivitySchema(many=True).dump(q.order_by(Activity.code.asc()).all())

    # ---------- Budget ----------

    @blp_budget.route("/budgets", methods=["GET", "POST"])
    @jwt_required()
    def budgets():
        with app.session_factory() as db:
            if request.method == "POST":
                print("Data: {}" , request.json)
                payload = BudgetSchema().load(request.json)
                bl = db.query(BudgetLine).get(payload["budget_line_id"])
                act = db.query(Activity).get(payload["activity_id"])
                if not bl or not act or act.budget_line_id != bl.id:
                    return {"message": "Invalid BudgetLine/Activity combination"}, 400

                if payload.get("hospital_id") is None:
                    fac = db.query(Facility).get(payload["facility_id"])
                    if not getattr(fac, "referral_hospital_id"):
                        return {"message": "Hospital must not be null"}, 400
                    payload.update({"hospital_id": fac.referral_hospital_id})

                obj = Budget(**payload)
                db.add(obj);
                db.commit();
                db.refresh(obj)
                return BudgetSchema().dump(obj), 201

            # ---- server-side filtering
            q = db.query(Budget)
            for key in ("hospital_id", "facility_id", "budget_line_id", "activity_id", "level"):
                val = request.args.get(key)
                if val:
                    if key == "level":
                        q = q.filter(Budget.level == val)
                    else:
                        q = q.filter(getattr(Budget, key) == int(val))

            text = request.args.get("q")
            if text:
                like = f"%{text}%"
                q = q.filter(
                    (Budget.activity_description.ilike(like)) |
                    (Budget.component_1.ilike(like)) |
                    (Budget.component_2.ilike(like)) |
                    (Budget.component_3.ilike(like)) |
                    (Budget.component_4.ilike(like))
                )

            # ---- server-side sorting
            sort_by = request.args.get("sort_by")  # column name in Budget
            sort_dir = (request.args.get("sort_dir") or "asc").lower()
            sortable = {
                "id": Budget.id,
                "level": Budget.level,
                "budget_line_id": Budget.budget_line_id,
                "activity_id": Budget.activity_id,
                "hospital_id": Budget.hospital_id,
                "facility_id": Budget.facility_id,
                "created_at": Budget.created_at,
                # numeric columns
                "estimated_number_quantity": Budget.estimated_number_quantity,
                "estimated_frequency_occurrence": Budget.estimated_frequency_occurrence,
                "unit_price_usd": Budget.unit_price_usd,
                "cost_per_unit_rwf": Budget.cost_per_unit_rwf,
                "percent_effort_share": Budget.percent_effort_share,
            }
            if sort_by in sortable:
                q = q.order_by(sortable[sort_by].desc() if sort_dir == "desc" else sortable[sort_by].asc())
            else:
                q = q.order_by(Budget.id.desc())

            # ---- server-side pagination
            page = max(int(request.args.get("page", 0)), 0)
            page_size = min(max(int(request.args.get("page_size", 25)), 1), 200)

            total = q.count()
            items = q.offset(page * page_size).limit(page_size).all()

            return {"items": BudgetSchema(many=True).dump(items), "total": total}, 200

    # --- Update a budget ---
    @blp_budget.route("/budgets/<int:bid>", methods=["PUT"])
    @jwt_required()
    def budget_update(bid):
        from schemas import BudgetSchema
        with app.session_factory() as db:
            obj = db.query(Budget).get(bid)
            if not obj:
                return {"message": "Not found"}, 404
            payload = BudgetSchema(partial=True).load(request.json)

            if  payload.get("hospital_id") is None:
                fac = db.query(Facility).get(payload["facility_id"])
                if not getattr(fac, "referral_hospital_id"):
                    return {"message": "Hospital must not be null"}, 400
                payload.update({"hospital_id" : fac.referral_hospital_id})

            # optional sanity
            if "budget_line_id" in payload or "activity_id" in payload:
                bl_id = payload.get("budget_line_id", obj.budget_line_id)
                act_id = payload.get("activity_id", obj.activity_id)
                bl = db.query(BudgetLine).get(bl_id)
                act = db.query(Activity).get(act_id)
                if not bl or not act or act.budget_line_id != bl.id:
                    return {"message": "Activity must belong to the given Budget Line"}, 400

            for k, v in payload.items():
                setattr(obj, k, v)
            db.commit();
            db.refresh(obj)
            return BudgetSchema().dump(obj)

    # --- Delete a budget ---
    @blp_budget.route("/budgets/<int:bid>", methods=["DELETE"])
    @jwt_required()
    def budget_delete(bid):
        with app.session_factory() as db:
            obj = db.query(Budget).get(bid)
            if not obj:
                return {"message": "Not found"}, 404
            db.delete(obj);
            db.commit()
            return {"ok": True}, 200


    @blp_budget.route("/budgets/aggregate", methods=["GET", "OPTIONS"])
    @jwt_required()
    def budgets_aggregate():
        with app.session_factory() as db:
            # Sum Decimal(Numeric) columns; keep in SQL as Numeric, then cast to Float for transport
            s1 = func.coalesce(func.sum(Budget.component_1), 0)
            s2 = func.coalesce(func.sum(Budget.component_2), 0)
            s3 = func.coalesce(func.sum(Budget.component_3), 0)
            s4 = func.coalesce(func.sum(Budget.component_4), 0)

            # If you prefer doing the cast in SQL (optional):
            total_components = cast(s1 + s2 + s3 + s4, Float).label("sum_components")

            q = db.query(
                func.count(Budget.id).label("count"),
                total_components
            )

            # ----- filters (mirror your list endpoint) -----
            txt = request.args.get("q")
            if txt:
                like = f"%{txt}%"
                q = q.filter(
                    (Budget.activity_description.ilike(like)) |
                    (cast(Budget.component_1, Text).ilike(like)) |
                    (cast(Budget.component_2, Text).ilike(like)) |
                    (cast(Budget.component_3, Text).ilike(like)) |
                    (cast(Budget.component_4, Text).ilike(like))
                )

            for key in ("hospital_id", "facility_id", "budget_line_id", "activity_id", "level"):
                val = request.args.get(key)
                if val:
                    if key == "level":
                        q = q.filter(Budget.level == val)
                    else:
                        q = q.filter(getattr(Budget, key) == int(val))

            count, sum_components = q.one()  # single row (aggregates)
            # sum_components is already a float due to cast(Float)
            return {
                "count": int(count or 0),
                "sum_components": float(sum_components or 0.0),
            }, 200

    # ---------- Execution ----------
    @blp_exec.route("/cashbook", methods=["GET","POST"])
    @jwt_required()
    def cashbook():
        with SessionLocal() as db:
            if request.method == "POST":
                data = CashbookEntrySchema().load(request.json)
                e = CashbookEntry(**data); db.add(e); db.commit(); db.refresh(e)
                return CashbookEntrySchema().dump(e), 201
            q = db.query(CashbookEntry)
            facility_id = request.args.get("facility_id", type=int)
            year = request.args.get("year", type=int)
            quarter = request.args.get("quarter", type=int)
            if facility_id: q = q.filter(CashbookEntry.facility_id == facility_id)
            if year: q = q.filter(CashbookEntry.year == year)
            if quarter: q = q.filter(CashbookEntry.quarter == quarter)
            return CashbookEntrySchema(many=True).dump(q.order_by(CashbookEntry.txn_date.asc()).all())

    @blp_exec.route("/obligations", methods=["GET","POST"])
    @jwt_required()
    def obligations():
        with SessionLocal() as db:
            if request.method == "POST":
                data = ObligationSchema().load(request.json)
                o = Obligation(**data); db.add(o); db.commit(); db.refresh(o)
                return ObligationSchema().dump(o), 201
            q = db.query(Obligation)
            facility_id = request.args.get("facility_id", type=int)
            year = request.args.get("year", type=int)
            quarter = request.args.get("quarter", type=int)
            if facility_id: q = q.filter(Obligation.facility_id == facility_id)
            if year: q = q.filter(Obligation.year == year)
            if quarter: q = q.filter(Obligation.quarter == quarter)
            return ObligationSchema(many=True).dump(q.all())

    # ---------- Adjustments ----------
    @blp_exec.route("/reallocations", methods=["GET","POST"])
    @jwt_required()
    def reallocations():
        with SessionLocal() as db:
            if request.method == "POST":
                data = ReallocationSchema().load(request.json)
                r = Reallocation(**data); db.add(r); db.commit(); db.refresh(r)
                return ReallocationSchema().dump(r), 201
            q = db.query(Reallocation)
            facility_id = request.args.get("facility_id", type=int)
            if facility_id: q = q.filter(Reallocation.facility_id == facility_id)
            return ReallocationSchema(many=True).dump(q.all())

    @blp_exec.route("/redirections", methods=["GET","POST"])
    @jwt_required()
    def redirections():
        with SessionLocal() as db:
            if request.method == "POST":
                data = RedirectionSchema().load(request.json)
                r = Redirection(**data); db.add(r); db.commit(); db.refresh(r)
                return RedirectionSchema().dump(r), 201
            q = db.query(Redirection)
            facility_id = request.args.get("facility_id", type=int)
            if facility_id: q = q.filter(Redirection.facility_id == facility_id)
            return RedirectionSchema(many=True).dump(q.all())

    # ---------- Quarter ----------
    @blp_exec.route("/quarters", methods=["GET","POST"])
    @jwt_required()
    def quarters():
        with SessionLocal() as db:
            if request.method == "POST":
                data = QuarterSchema().load(request.json)
                q = Quarter(**data); db.add(q); db.commit(); db.refresh(q)
                return QuarterSchema().dump(q), 201
            q = db.query(Quarter)
            facility_id = request.args.get("facility_id", type=int)
            year = request.args.get("year", type=int)
            quarter = request.args.get("quarter", type=int)
            if facility_id: q = q.filter(Quarter.facility_id == facility_id)
            if year: q = q.filter(Quarter.year == year)
            if quarter: q = q.filter(Quarter.quarter == quarter)
            return QuarterSchema(many=True).dump(q.all())

    @blp_exec.route("/quarter-lines", methods=["GET","POST"])
    @jwt_required()
    def quarter_lines():
        with SessionLocal() as db:
            if request.method == "POST":
                data = QuarterLineSchema().load(request.json)
                l = QuarterLine(**data); db.add(l); db.commit(); db.refresh(l)
                return QuarterLineSchema().dump(l), 201
            q = db.query(QuarterLine)
            quarter_id = request.args.get("quarter_id", type=int)
            if quarter_id: q = q.filter(QuarterLine.quarter_id == quarter_id)
            return QuarterLineSchema(many=True).dump(q.all())

    # ---------- Reports ----------
    @blp_report.route("/summary", methods=["GET"])
    @jwt_required()
    def report_summary():
        args = request.args
        with SessionLocal() as db:
            data = build_summary_report(db, int(args["facility_id"]), int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/statement", methods=["GET"])
    @jwt_required()
    def report_statement():
        args = request.args
        with SessionLocal() as db:
            data = build_statement_report(db, int(args["facility_id"]), int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/bank-recon", methods=["GET"])
    @jwt_required()
    def report_bank():
        args = request.args
        with SessionLocal() as db:
            data = build_bank_recon(db, int(args["facility_id"]), int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/hrh", methods=["GET"])
    @jwt_required()
    def report_hrh():
        args = request.args
        with SessionLocal() as db:
            data = build_hrh_report(db, int(args["facility_id"]), int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/reallocation", methods=["GET"])
    @jwt_required()
    def report_reallocation():
        args = request.args
        with SessionLocal() as db:
            data = build_reallocation_report(db, int(args["facility_id"]), int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    # ---- Accounts (minimal CRUD helpful for wiring) ----

    @blp_cashbook.route("/accounts", methods=["GET"])
    @jwt_required()
    def list_accounts():
        q = request.args.get("q", type=str)
        hospital_id = request.args.get("hospital_id", type=int)
        facility_id = request.args.get("facility_id", type=int)
        page = request.args.get("page", default=0, type=int)
        page_size = request.args.get("page_size", default=1000, type=int)

        with get_session() as sess:  # type: Session
            bal = _balance_subq()

            query = sess.query(Account, bal.label("current_balance"))

            if q:
                query = query.filter(Account.name.ilike(f"%{q}%"))
            if hospital_id:
                query = query.filter(Account.hospital_id == hospital_id)
            if facility_id:
                query = query.filter(Account.facility_id == facility_id)

            total = query.count()
            items = (
                query
                .order_by(Account.name.asc())
                .offset(page * page_size)
                .limit(page_size)
                .all()
            )

            # Flatten (Account, balance) -> dict with current_balance
            payload = []
            for acc, balance in items:
                data = read_account_schema.dump(acc)
                # balance may be Decimal/None
                data["current_balance"] = str(balance or 0)
                payload.append(data)

            return jsonify({"items": payload, "total": total})

    @blp_cashbook.route("/accounts/<int:account_id>", methods=["GET","OPTIONS"])
    @jwt_required()
    def get_account(account_id: int):
        with get_session() as sess:
            bal = _balance_subq()
            row = (
                sess.query(Account, bal.label("current_balance"))
                .filter(Account.id == account_id)
                .first()
            )
            if not row:
                return jsonify({"message": "Not found"}), 404
            acc, balance = row
            data = read_account_schema.dump(acc)
            data["current_balance"] = str(balance or 0)
            return jsonify(data)

    @blp_cashbook.route("/accounts", methods=["POST"])
    @jwt_required()
    def create_account():
        payload = create_account_schema.load(request.get_json() or {})
        with get_session() as sess:
            acc = Account(**payload)
            sess.add(acc)
            sess.commit()
            sess.refresh(acc)
            data = read_account_schema.dump(acc)
            data["current_balance"] = "0"
            return jsonify(data), 201

    @blp_cashbook.route("/accounts/<int:account_id>", methods=["PUT", "PATCH"])
    @jwt_required()
    def update_account(account_id: int):
        payload = update_account_schema.load(request.get_json() or {})
        print(payload)
        with get_session() as sess:
            acc = sess.get(Account, account_id)
            if not acc:
                return jsonify({"message": "Not found"}), 404

            for k, v in payload.items():
                setattr(acc, k, v)
            sess.commit()
            sess.refresh(acc)

            # recompute balance for this one
            bal = (
                      sess.query(func.coalesce(func.sum((Cashbook.cash_in or 0) - (Cashbook.cash_out or 0)), 0))
                      .filter(Cashbook.account_id == acc.id)
                      .scalar()
                  ) or 0

            data = read_schema.dump(acc)
            data["current_balance"] = str(bal)
            return jsonify(data)

    @blp_cashbook.route("/accounts/<int:account_id>", methods=["DELETE"])
    @jwt_required()
    def delete_account(account_id: int):
        with get_session() as sess:
            acc = sess.get(Account, account_id)
            if not acc:
                return jsonify({"message": "Not found"}), 404
            sess.delete(acc)
            sess.commit()
            return jsonify({"message": "Deleted"})

    # ---- Cashbook CRUD ----

    @blp_cashbook.route("/cashbooks", methods=["POST"])
    @jwt_required()
    def create_cashbook():
        payload = request.get_json() or {}
        data = create_schema.load(payload)

        with SessionLocal() as sess:
            cb = Cashbook(**data)
            Cashbook.prepare_for_insert(sess, cb)  # <- uses the fixed version
            sess.add(cb)
            sess.flush()  # balance is already non-null here
            Cashbook.recalc_account_balances(sess, cb.account_id)
            sess.commit()
            sess.refresh(cb)
            return read_schema.dump(cb), 201

    @blp_cashbook.route("/cashbooks", methods=["GET"])
    @jwt_required()
    def list_cashbooks():
        # optional filters: account_id, facility_id, hospital_id, quarter, date range
        q = request.args
        with SessionLocal() as sess:
            stmt = select(Cashbook)

            if "account_id" in q:
                stmt = stmt.where(Cashbook.account_id == int(q["account_id"]))
            if "facility_id" in q:
                stmt = stmt.where(Cashbook.facility_id == int(q["facility_id"]))
            if "hospital_id" in q:
                stmt = stmt.where(Cashbook.hospital_id == int(q["hospital_id"]))
            if "quarter" in q:
                stmt = stmt.where(Cashbook.quarter == q["quarter"])
            if "date_from" in q:
                stmt = stmt.where(Cashbook.transaction_date >= q.get("date_from"))
            if "date_to" in q:
                stmt = stmt.where(Cashbook.transaction_date <= q.get("date_to"))

            stmt = stmt.order_by(Cashbook.transaction_date.desc(), Cashbook.id.desc())
            rows = list(sess.scalars(stmt))
            return read_many_schema.dump(rows), 200

    @blp_cashbook.route("/cashbooks/<int:cb_id>", methods=["GET"])
    @jwt_required()
    def get_cashbook(cb_id: int):
        with SessionLocal() as sess:
            cb = sess.get(Cashbook, cb_id)
            if not cb:
                return {"message": "Not found"}, 404
            return read_schema.dump(cb), 200

    @blp_cashbook.route("/cashbooks/<int:cb_id>", methods=["PUT","PATCH"])
    @jwt_required()
    def update_cashbook(cb_id: int):
        payload = request.get_json() or {}
        data = update_schema.load(payload, partial=True)

        with SessionLocal() as sess:
            cb: Cashbook | None = sess.get(Cashbook, cb_id)
            if not cb:
                return {"message": "Not found"}, 404

            old_account_id = cb.account_id

            # apply partial fields
            for k, v in data.items():
                setattr(cb, k, v)

            # If transaction_date changed, recompute quarter
            if "transaction_date" in data:
                Cashbook.set_quarter(cb)

            # If cash amounts changed, we’ll recalc rolling balances anyway

            sess.flush()

            # If facility changed and reference was originally auto, you can regenerate (optional).
            # To keep references stable, we won't change it by default.

            # Recalc balances for affected account(s)
            if cb.account_id != old_account_id:
                if old_account_id:
                    Cashbook.recalc_account_balances(sess, old_account_id)
                Cashbook.recalc_account_balances(sess, cb.account_id)
            else:
                Cashbook.recalc_account_balances(sess, cb.account_id)

            sess.commit()
            sess.refresh(cb)
            return read_schema.dump(cb), 200

    @blp_cashbook.route("/cashbooks/<int:cb_id>", methods=["DELETE"])
    @jwt_required()
    def delete_cashbook(cb_id: int):
        with SessionLocal() as sess:
            cb: Cashbook | None = sess.get(Cashbook, cb_id)
            if not cb:
                return {"message": "Not found"}, 404
            account_id = cb.account_id
            sess.delete(cb)
            sess.flush()

            # Recalc after deletion
            Cashbook.recalc_account_balances(sess, account_id)

            sess.commit()
            return {"message": "Deleted"}, 200

    # Register blueprints (smorest)
    api.register_blueprint(blp_geo)
    api.register_blueprint(blp_budget)
    api.register_blueprint(blp_exec)
    api.register_blueprint(blp_report)
    api.register_blueprint(blp_auth)  # /auth/login (smorest Blueprint)
    api.register_blueprint(blp_cashbook)

    # Quick health + (optional) JWT debug
    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/debug/jwt")
    def debug_jwt():
        return {
            "has_SECRET_KEY": bool(app.config.get("SECRET_KEY")),
            "has_JWT_SECRET_KEY": bool(app.config.get("JWT_SECRET_KEY")),
            "JWT_ALGORITHM": app.config.get("JWT_ALGORITHM", "HS256")
        }

    return app
