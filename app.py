# app.py  (UPDATED: adds Admin endpoints for user registration + editing ONLY)
import os
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_smorest import Api, Blueprint
from flask_cors import CORS
from sqlalchemy import create_engine, func, cast, Float, Text, select
from sqlalchemy.orm import scoped_session, sessionmaker, Session
from sqlalchemy.exc import IntegrityError
import pandas as pd

from config import db_uri
from models import (
    Base,
    Country,
    Province,
    District,
    Hospital,
    Facility,
    BudgetLine,
    Activity,
    Budget,
    Quarter,
    QuarterLine,
    CashbookEntry,
    Obligation,
    Reallocation,
    Redirection,
    User,
    Cashbook,
    Account,
    AccessLevelEnum,
)
from schemas import *
from services.reporting import (
    build_summary_report,
    build_statement_report,
    build_bank_recon,
    build_hrh_report,
    build_reallocation_report,
)
from auth import blp_auth, init_jwt
from flask_jwt_extended import jwt_required, get_jwt
from werkzeug.exceptions import BadRequest, HTTPException, NotFound, Forbidden
from import_excel import (get_or_create_country, get_or_create_province, get_or_create_district,
                          get_or_create_hospital, get_or_create_facility, create_users_for_all_facilities)

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False))

UPLOAD_ALLOWED_EXTENSIONS = {"xlsx"}


@contextmanager
def get_session():
    """Session context with commit/rollback/close."""
    sess: Session = SessionLocal()
    try:
        yield sess
        sess.commit()
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in UPLOAD_ALLOWED_EXTENSIONS
def _balance_subq():
    # sum(cash_in - cash_out) per account
    return (
        select(func.coalesce(func.sum((Cashbook.cash_in - Cashbook.cash_out)), 0))
        .where(Cashbook.account_id == Account.id)
        .correlate(Account)
        .scalar_subquery()
    )


def _apply_facility_scope(query, model):
    """
    If current user is FACILITY-level, restrict queries on models that have facility_id.
    COUNTRY (and other levels) see everything.
    """
    try:
        claims = get_jwt()
    except Exception:
        return query

    level = claims.get("access_level")
    if level == AccessLevelEnum.FACILITY.value and hasattr(model, "facility_id"):
        fid = claims.get("facility_id")
        if fid:
            return query.filter(getattr(model, "facility_id") == int(fid))
    return query


def require_name_and_code(data: dict, entity: str = "Location"):
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip()
    if not name or not code:
        raise BadRequest(description=f"{entity} must have both non-empty 'name' and 'code'.")


# ============================================================
# ✅ NEW: Admin user management helpers (registration/editing)
# ============================================================

def _require_country_admin():
    claims = get_jwt()
    if claims.get("access_level") != AccessLevelEnum.COUNTRY.value:
        raise Forbidden(description="forbidden")


def _as_access_level(value):
    """
    Accept strings like: 'COUNTRY', 'HOSPITAL', 'FACILITY'
    or enum values if your AccessLevelEnum uses same values.
    """
    if value is None:
        return None
    if isinstance(value, AccessLevelEnum):
        return value

    v = str(value).strip()
    if not v:
        return None

    # try enum by name (COUNTRY/HOSPITAL/FACILITY)
    try:
        return AccessLevelEnum[v]
    except Exception:
        pass

    # try enum by value (if values are "COUNTRY", etc.)
    try:
        return AccessLevelEnum(v)
    except Exception:
        raise BadRequest(description=f"Invalid access_level '{value}'.")


def _validate_user_payload_for_create(payload: dict):
    username = (payload.get("username") or "").strip()
    password = (payload.get("password") or "").strip()
    access_level = _as_access_level(payload.get("access_level"))

    if not username:
        raise BadRequest(description="username is required")
    if not password:
        raise BadRequest(description="password is required")
    if not access_level:
        raise BadRequest(description="access_level is required")

    # Normalize IDs
    country_id = payload.get("country_id")
    hospital_id = payload.get("hospital_id")
    facility_id = payload.get("facility_id")

    # Enforce assignment rules
    if access_level == AccessLevelEnum.COUNTRY:
        # country-level can optionally be bound to a country_id (multi-country ready),
        # but you can require it by uncommenting below.
        # if not country_id: raise BadRequest(description="country_id is required for COUNTRY access_level")
        pass

    elif access_level == AccessLevelEnum.HOSPITAL:
        if not hospital_id:
            raise BadRequest(description="hospital_id is required for HOSPITAL access_level")
        # optional: infer country_id via hospital->province->country if you want, leave flexible

    elif access_level == AccessLevelEnum.FACILITY:
        if not facility_id:
            raise BadRequest(description="facility_id is required for FACILITY access_level")

    else:
        # If you later extend levels
        raise BadRequest(description=f"Unsupported access_level '{access_level.value}'.")

    return {
        "username": username,
        "password": password,
        "access_level": access_level,
        "country_id": int(country_id) if country_id else None,
        "hospital_id": int(hospital_id) if hospital_id else None,
        "facility_id": int(facility_id) if facility_id else None,
    }


def _validate_user_payload_for_update(payload: dict):
    # All optional
    out = {}

    if "username" in payload:
        username = (payload.get("username") or "").strip()
        if not username:
            raise BadRequest(description="username cannot be empty")
        out["username"] = username

    if "password" in payload:
        password = (payload.get("password") or "").strip()
        if password:
            out["password"] = password
        else:
            # if they send empty password, ignore (or raise). Choose ignore for safety.
            out["password"] = None

    if "access_level" in payload:
        out["access_level"] = _as_access_level(payload.get("access_level"))

    # IDs (optional)
    for k in ("country_id", "hospital_id", "facility_id"):
        if k in payload:
            v = payload.get(k)
            out[k] = int(v) if v not in (None, "", 0) else None

    # If access_level is being changed (or present), enforce consistency
    lvl = out.get("access_level")
    if lvl is not None:
        if lvl == AccessLevelEnum.COUNTRY:
            # ok
            pass
        elif lvl == AccessLevelEnum.HOSPITAL:
            if not out.get("hospital_id") and "hospital_id" not in payload:
                # they changed level to HOSPITAL but didn't provide hospital_id
                raise BadRequest(description="hospital_id is required for HOSPITAL access_level")
        elif lvl == AccessLevelEnum.FACILITY:
            if not out.get("facility_id") and "facility_id" not in payload:
                raise BadRequest(description="facility_id is required for FACILITY access_level")
        else:
            raise BadRequest(description=f"Unsupported access_level '{lvl.value}'.")

    return out


def _user_to_dict(u: User):
    # minimal safe payload for UI
    return {
        "id": u.id,
        "username": u.username,
        "access_level": getattr(u, "access_level").value if getattr(u, "access_level", None) else None,
        "country_id": getattr(u, "country_id", None),
        "hospital_id": getattr(u, "hospital_id", None),
        "facility_id": getattr(u, "facility_id", None),
        "is_active": getattr(u, "is_active", True),
        "created_at": getattr(u, "created_at", None).isoformat() if getattr(u, "created_at", None) else None,
        "updated_at": getattr(u, "updated_at", None).isoformat() if getattr(u, "updated_at", None) else None,
    }


def create_app():
    app = Flask(__name__)

    # --- KEYS before init_jwt ---
    app.config.setdefault("SECRET_KEY", os.environ.get("SECRET_KEY", "dev-secret-change-me"))
    app.config.setdefault("JWT_SECRET_KEY", os.environ.get("JWT_SECRET_KEY", app.config["SECRET_KEY"]))

    app.config.update(
        {
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
        }
    )

    # CORS for your React front-end
    CORS(
        app,
        resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    api = Api(app)

    # DB
    engine = create_engine(db_uri(), future=True)
    SessionLocal.configure(bind=engine)
    Base.metadata.create_all(engine)
    app.session_factory = SessionLocal

    # JWT
    init_jwt(app)

    # ---- CLI helpers ----
    @app.cli.command("db_init")
    def db_init():
        Base.metadata.create_all(engine)
        print("Database initialized.")

    @app.cli.command("create_admin")
    def create_admin():
        """
        Create a COUNTRY-level admin user.
        You can set ADMIN_USERNAME / ADMIN_PASSWORD env vars before running.
        """
        username = os.environ.get("ADMIN_USERNAME", "admin")
        password = os.environ.get("ADMIN_PASSWORD", "admin123")
        with SessionLocal() as db:
            u = db.query(User).filter_by(username=username).first()
            if not u:
                u = User(username=username, access_level=AccessLevelEnum.COUNTRY)
                u.set_password(password)
                db.add(u)
                db.commit()
                print(f"Created admin user '{username}' with COUNTRY access.")
            else:
                print(f"User '{username}' already exists.")

    @app.errorhandler(HTTPException)
    def handle_http_exception(e):
        return jsonify({"error": e.name, "message": e.description, "status": e.code}), e.code

    # ---- Blueprints ----
    blp_geo = Blueprint("geo", __name__, url_prefix="/")
    blp_budget = Blueprint("budget", __name__, url_prefix="/")
    blp_cashbook = Blueprint("cashbook", __name__, url_prefix="/")
    blp_exec = Blueprint("exec", __name__, url_prefix="/")
    blp_report = Blueprint("report", __name__, url_prefix="/reports")

    # ✅ NEW: Admin endpoints for Users
    blp_admin = Blueprint("admin", __name__, url_prefix="/admin")

    # Schemas instances
    create_schema = CashbookCreateSchema()
    update_schema = CashbookUpdateSchema()
    read_schema = CashbookReadSchema()
    read_many_schema = CashbookReadSchema(many=True)
    read_account_schema = AccountReadSchema()
    create_account_schema = AccountCreateSchema()
    update_account_schema = AccountUpdateSchema()

    def apply_access_filter(query, model):
        """
        Restrict query results based on user's access level
        """
        claims = get_jwt()
        level = claims.get("access_level")
        print(claims.values(), level, claims["facility_id"], hasattr(model, "facility_id"))
        if level == "COUNTRY":
            return query

        if level == "PROVINCE":
            return query.filter(model.province_id == claims["province_id"])

        if level == "DISTRICT":
            return query.filter(model.district_id == claims["district_id"])

        if level == "HOSPITAL":
            return query.filter(model.referral_hospital_id == claims["hospital_id"])

        if level == "FACILITY":
            return query.filter(model.id == claims["facility_id"])

        return query.filter(False)  # deny by default

    def validate_create_access(data):
        """
        Prevent creating data outside user's scope
        """
        claims = get_jwt()
        level = claims["access_level"]

        def deny():
            return jsonify({"error": "Access denied"}), 403

        if level == "COUNTRY":
            return None

        if level == "PROVINCE" and data.get("province_id") != claims["province_id"]:
            return deny()

        if level == "DISTRICT" and data.get("district_id") != claims["district_id"]:
            return deny()

        if level == "HOSPITAL" and data.get("hospital_id") != claims["hospital_id"]:
            return deny()

        if level == "FACILITY" and data.get("facility_id") != claims["facility_id"]:
            return deny()

        return None

    # ============================================================
    # ✅ NEW: /admin/users endpoints (UI: users.create/users.update)
    # ============================================================

    @blp_admin.route("/users", methods=["GET"])
    @jwt_required()
    def admin_list_users():
        _require_country_admin()
        qtxt = (request.args.get("q") or "").strip()

        with get_session() as sess:
            q = sess.query(User)
            if qtxt:
                q = q.filter(User.username.ilike(f"%{qtxt}%"))
            users_ = q.order_by(User.username.asc()).all()
            #print(users_)
            return jsonify([_user_to_dict(u) for u in users_])

    @blp_admin.route("/users/<int:user_id>", methods=["GET"])
    @jwt_required()
    def admin_get_user(user_id: int):
        _require_country_admin()
        with get_session() as sess:
            u = sess.get(User, user_id)
            if not u:
                raise NotFound(description="Not found")
            return jsonify(_user_to_dict(u))

    @blp_admin.route("/users", methods=["POST"])
    @jwt_required()
    def admin_create_user():
        _require_country_admin()
        payload = request.get_json(silent=True) or {}
        data = _validate_user_payload_for_create(payload)

        with get_session() as sess:
            exists = sess.query(User).filter(User.username == data["username"]).first()
            if exists:
                raise BadRequest(description="username already exists")

            u = User(
                username=data["username"],
                access_level=data["access_level"],
                country_id=data["country_id"],
                hospital_id=data["hospital_id"],
                facility_id=data["facility_id"],
            )
            u.set_password(data["password"])

            sess.add(u)
            sess.flush()  # assign id
            sess.refresh(u)
            return jsonify(_user_to_dict(u)), 201

    @blp_admin.route("/users/<int:user_id>", methods=["PUT", "PATCH"])
    @jwt_required()
    def admin_update_user(user_id: int):
        _require_country_admin()
        payload = request.get_json(silent=True) or {}
        data = _validate_user_payload_for_update(payload)

        with get_session() as sess:
            u: User | None = sess.get(User, user_id)
            if not u:
                raise NotFound(description="Not found")

            # Username change uniqueness
            if "username" in data and data["username"] != u.username:
                exists = sess.query(User).filter(User.username == data["username"]).first()
                if exists:
                    raise BadRequest(description="username already exists")
                u.username = data["username"]

            # password
            if "password" in data and data["password"]:
                u.set_password(data["password"])

            # access level / assignments
            if "access_level" in data and data["access_level"] is not None:
                u.access_level = data["access_level"]

            for k in ("country_id", "hospital_id", "facility_id"):
                if k in data:
                    setattr(u, k, data[k])

            # Final consistency check (use current values)
            lvl = getattr(u, "access_level", None)
            if lvl == AccessLevelEnum.HOSPITAL and not getattr(u, "hospital_id", None):
                raise BadRequest(description="hospital_id is required for HOSPITAL access_level")
            if lvl == AccessLevelEnum.FACILITY and not getattr(u, "facility_id", None):
                raise BadRequest(description="facility_id is required for FACILITY access_level")

            sess.flush()
            sess.refresh(u)
            return jsonify(_user_to_dict(u))

    @blp_admin.route("/users/<int:user_id>", methods=["DELETE"])
    @jwt_required()
    def admin_delete_user(user_id: int):
        _require_country_admin()
        with get_session() as sess:
            u = sess.get(User, user_id)
            if not u:
                raise NotFound(description="Not found")
            sess.delete(u)
            return jsonify({"ok": True})

    # ---------- Geo ----------
    @blp_geo.route("/countries", methods=["GET", "POST"])
    @jwt_required()
    def countries():
        with SessionLocal() as db:
            if request.method == "POST":
                data = CountrySchema().load(request.json)
                require_name_and_code(data, "Country")
                obj = Country(**data)
                db.add(obj)
                db.commit()
                db.refresh(obj)
                return CountrySchema().dump(obj), 201
            items = db.query(Country).order_by(Country.name.asc()).all()
            return CountrySchema(many=True).dump(items)

    @blp_geo.route("/provinces", methods=["GET", "POST"])
    @jwt_required()
    def provinces():
        with SessionLocal() as db:
            if request.method == "POST":
                data = ProvinceSchema().load(request.json)
                require_name_and_code(data, "Province")
                obj = Province(**data)
                db.add(obj)
                db.commit()
                db.refresh(obj)
                return ProvinceSchema().dump(obj), 201
            q = db.query(Province)
            q = apply_access_filter(q, Province)
            country_id = request.args.get("country_id", type=int)
            if country_id:
                q = q.filter(Province.country_id == country_id)
            return ProvinceSchema(many=True).dump(q.order_by(Province.name.asc()).all())

    @blp_geo.route("/districts", methods=["GET", "POST"])
    @jwt_required()
    def districts():
        with SessionLocal() as db:
            if request.method == "POST":
                data = DistrictSchema().load(request.json)
                require_name_and_code(data, "District")
                obj = District(**data)
                db.add(obj)
                db.commit()
                db.refresh(obj)
                return DistrictSchema().dump(obj), 201
            q = db.query(District)
            q = apply_access_filter(q, District)
            province_id = request.args.get("province_id", type=int)
            if province_id:
                q = q.filter(District.province_id == province_id)
            return DistrictSchema(many=True).dump(q.order_by(District.name.asc()).all())

    @blp_geo.route("/hospitals", methods=["GET", "POST"])
    @jwt_required()
    def hospitals():
        with SessionLocal() as db:
            if request.method == "POST":
                data = HospitalSchema().load(request.json)
                require_name_and_code(data, "Hospital")
                obj = Hospital(**data)
                db.add(obj)
                db.commit()
                db.refresh(obj)
                return HospitalSchema().dump(obj), 201
            q = db.query(Hospital)
            q = apply_access_filter(q, Hospital)
            province_id = request.args.get("province_id", type=int)
            district_id = request.args.get("district_id", type=int)
            if province_id:
                q = q.filter(Hospital.province_id == province_id)
            if district_id:
                q = q.filter(Hospital.district_id == district_id)
            return HospitalSchema(many=True).dump(q.order_by(Hospital.name.asc()).all())

    @blp_geo.route("/facilities", methods=["GET", "POST"])
    @jwt_required()
    def facilities():
        with SessionLocal() as db:
            if request.method == "POST":
                data = FacilitySchema().load(request.json)
                require_name_and_code(data, "Facility")
                obj = Facility(**data)
                db.add(obj)
                db.commit()
                db.refresh(obj)
                return FacilitySchema().dump(obj), 201
            q = db.query(Facility)
            q = apply_access_filter(q, Facility)
            print(q)
            country_id = request.args.get("country_id", type=int)
            province_id = request.args.get("province_id", type=int)
            district_id = request.args.get("district_id", type=int)
            ref_id = request.args.get("referral_hospital_id", type=int)
            print (country_id, province_id, district_id, ref_id)
            if country_id:
                q = q.filter(Facility.country_id == country_id)
            if province_id:
                q = q.filter(Facility.province_id == province_id)
            if district_id:
                q = q.filter(Facility.district_id == district_id)
            if ref_id:
                q = q.filter(Facility.referral_hospital_id == ref_id)
            return FacilitySchema(many=True).dump(q.order_by(Facility.name.asc()).all())

    # ---------- BudgetLine ----------
    @blp_budget.route("/budget-lines", methods=["GET", "POST"])
    @jwt_required()
    def budget_lines():
        with app.session_factory() as db:
            if request.method == "POST":
                payload = BudgetLineSchema().load(request.json)
                obj = BudgetLine(**payload)
                db.add(obj)
                db.commit()
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
                bl = db.query(BudgetLine).get(payload["budget_line_id"])
                if not bl:
                    return {"message": "budget_line_id not found"}, 400
                obj = Activity(**payload)
                db.add(obj)
                db.commit()
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
        from sqlalchemy import cast as sa_cast

        with app.session_factory() as db:
            if request.method == "POST":
                payload = BudgetSchema().load(request.json)

                bl = db.query(BudgetLine).get(payload["budget_line_id"])
                act = db.query(Activity).get(payload["activity_id"])
                if not bl or not act or act.budget_line_id != bl.id:
                    return {"message": "Invalid BudgetLine/Activity combination"}, 400

                claims = get_jwt()
                if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                    fid = claims.get("facility_id")
                    if not fid:
                        return {"message": "No facility assigned to user"}, 403
                    payload["facility_id"] = int(fid)

                if payload.get("hospital_id") is None and payload.get("facility_id") is not None:
                    fac = db.query(Facility).get(payload["facility_id"])
                    if not getattr(fac, "referral_hospital_id", None):
                        return {"message": "Hospital must not be null"}, 400
                    payload["hospital_id"] = fac.referral_hospital_id

                obj = Budget(**payload)
                db.add(obj)
                db.commit()
                db.refresh(obj)
                return BudgetSchema().dump(obj), 201

            q = db.query(Budget)
            q = _apply_facility_scope(q, Budget)

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
                    (Budget.activity_description.ilike(like))
                    | (sa_cast(Budget.component_1, Text).ilike(like))
                    | (sa_cast(Budget.component_2, Text).ilike(like))
                    | (sa_cast(Budget.component_3, Text).ilike(like))
                    | (sa_cast(Budget.component_4, Text).ilike(like))
                )

            sort_by = request.args.get("sort_by")
            sort_dir = (request.args.get("sort_dir") or "asc").lower()
            sortable = {
                "id": Budget.id,
                "level": Budget.level,
                "budget_line_id": Budget.budget_line_id,
                "activity_id": Budget.activity_id,
                "hospital_id": Budget.hospital_id,
                "facility_id": Budget.facility_id,
                "created_at": Budget.created_at,
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

            page = max(int(request.args.get("page", 0)), 0)
            page_size = min(max(int(request.args.get("page_size", 25)), 1), 200)

            total = q.count()
            items = q.offset(page * page_size).limit(page_size).all()

            return {"items": BudgetSchema(many=True).dump(items), "total": total}, 200

    @blp_budget.route("/budgets/<int:bid>", methods=["PUT"])
    @jwt_required()
    def budget_update(bid):
        with app.session_factory() as db:
            obj = db.query(Budget).get(bid)
            if not obj:
                return {"message": "Not found"}, 404

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if not fid or obj.facility_id != int(fid):
                    return {"message": "forbidden for this facility"}, 403

            payload = BudgetSchema(partial=True).load(request.json)

            if payload.get("hospital_id") is None and payload.get("facility_id") is not None:
                fac = db.query(Facility).get(payload["facility_id"])
                if not getattr(fac, "referral_hospital_id", None):
                    return {"message": "Hospital must not be null"}, 400
                payload["hospital_id"] = fac.referral_hospital_id

            if "budget_line_id" in payload or "activity_id" in payload:
                bl_id = payload.get("budget_line_id", obj.budget_line_id)
                act_id = payload.get("activity_id", obj.activity_id)
                bl = db.query(BudgetLine).get(bl_id)
                act = db.query(Activity).get(act_id)
                if not bl or not act or act.budget_line_id != bl.id:
                    return {"message": "Activity must belong to the given Budget Line"}, 400

            for k, v in payload.items():
                setattr(obj, k, v)
            db.commit()
            db.refresh(obj)
            return BudgetSchema().dump(obj)

    @blp_budget.route("/budgets/<int:bid>", methods=["DELETE"])
    @jwt_required()
    def budget_delete(bid):
        with app.session_factory() as db:
            obj = db.query(Budget).get(bid)
            if not obj:
                return {"message": "Not found"}, 404

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if not fid or obj.facility_id != int(fid):
                    return {"message": "forbidden for this facility"}, 403

            db.delete(obj)
            db.commit()
            return {"ok": True}, 200

    @blp_budget.route("/budgets/aggregate", methods=["GET", "OPTIONS"])
    @jwt_required()
    def budgets_aggregate():
        with app.session_factory() as db:
            s1 = func.coalesce(func.sum(Budget.component_1), 0)
            s2 = func.coalesce(func.sum(Budget.component_2), 0)
            s3 = func.coalesce(func.sum(Budget.component_3), 0)
            s4 = func.coalesce(func.sum(Budget.component_4), 0)
            total_components = cast(s1 + s2 + s3 + s4, Float).label("sum_components")

            q = db.query(func.count(Budget.id).label("count"), total_components)
            q = _apply_facility_scope(q, Budget)

            txt = request.args.get("q")
            if txt:
                like = f"%{txt}%"
                q = q.filter(
                    (Budget.activity_description.ilike(like))
                    | (cast(Budget.component_1, Text).ilike(like))
                    | (cast(Budget.component_2, Text).ilike(like))
                    | (cast(Budget.component_3, Text).ilike(like))
                    | (cast(Budget.component_4, Text).ilike(like))
                )

            for key in ("hospital_id", "facility_id", "budget_line_id", "activity_id", "level"):
                val = request.args.get(key)
                if val:
                    if key == "level":
                        q = q.filter(Budget.level == val)
                    else:
                        q = q.filter(getattr(Budget, key) == int(val))

            count, sum_components = q.one()
            return {"count": int(count or 0), "sum_components": float(sum_components or 0.0)}, 200

    # ---------- Execution (legacy tables) ----------
    @blp_exec.route("/cashbook", methods=["GET", "POST"])
    @jwt_required()
    def cashbook_entries():
        with SessionLocal() as db:
            if request.method == "POST":
                data = CashbookEntrySchema().load(request.json)

                claims = get_jwt()
                if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                    fid = claims.get("facility_id")
                    if not fid:
                        return {"message": "No facility assigned to user"}, 403
                    data["facility_id"] = int(fid)

                e = CashbookEntry(**data)
                db.add(e)
                db.commit()
                db.refresh(e)
                return CashbookEntrySchema().dump(e), 201

            q = db.query(CashbookEntry)
            q = _apply_facility_scope(q, CashbookEntry)

            facility_id = request.args.get("facility_id", type=int)
            year = request.args.get("year", type=int)
            quarter = request.args.get("quarter", type=int)
            if facility_id:
                q = q.filter(CashbookEntry.facility_id == facility_id)
            if year:
                q = q.filter(CashbookEntry.year == year)
            if quarter:
                q = q.filter(CashbookEntry.quarter == quarter)
            return CashbookEntrySchema(many=True).dump(q.order_by(CashbookEntry.txn_date.asc()).all())

    @blp_exec.route("/obligations", methods=["GET", "POST"])
    @jwt_required()
    def obligations():
        with SessionLocal() as db:
            if request.method == "POST":
                data = ObligationSchema().load(request.json)

                claims = get_jwt()
                if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                    fid = claims.get("facility_id")
                    if not fid:
                        return {"message": "No facility assigned to user"}, 403
                    data["facility_id"] = int(fid)

                o = Obligation(**data)
                db.add(o)
                db.commit()
                db.refresh(o)
                return ObligationSchema().dump(o), 201

            q = db.query(Obligation)
            q = _apply_facility_scope(q, Obligation)

            facility_id = request.args.get("facility_id", type=int)
            year = request.args.get("year", type=int)
            quarter = request.args.get("quarter", type=int)
            if facility_id:
                q = q.filter(Obligation.facility_id == facility_id)
            if year:
                q = q.filter(Obligation.year == year)
            if quarter:
                q = q.filter(Obligation.quarter == quarter)
            return ObligationSchema(many=True).dump(q.all())

    @blp_exec.route("/reallocations", methods=["GET", "POST"])
    @jwt_required()
    def reallocations():
        with SessionLocal() as db:
            if request.method == "POST":
                data = ReallocationSchema().load(request.json)

                claims = get_jwt()
                if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                    fid = claims.get("facility_id")
                    if not fid:
                        return {"message": "No facility assigned to user"}, 403
                    data["facility_id"] = int(fid)

                r = Reallocation(**data)
                db.add(r)
                db.commit()
                db.refresh(r)
                return ReallocationSchema().dump(r), 201

            q = db.query(Reallocation)
            q = _apply_facility_scope(q, Reallocation)

            facility_id = request.args.get("facility_id", type=int)
            if facility_id:
                q = q.filter(Reallocation.facility_id == facility_id)
            return ReallocationSchema(many=True).dump(q.all())

    @blp_exec.route("/redirections", methods=["GET", "POST"])
    @jwt_required()
    def redirections():
        with SessionLocal() as db:
            if request.method == "POST":
                data = RedirectionSchema().load(request.json)

                claims = get_jwt()
                if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                    fid = claims.get("facility_id")
                    if not fid:
                        return {"message": "No facility assigned to user"}, 403
                    data["facility_id"] = int(fid)

                r = Redirection(**data)
                db.add(r)
                db.commit()
                db.refresh(r)
                return RedirectionSchema().dump(r), 201

            q = db.query(Redirection)
            q = _apply_facility_scope(q, Redirection)

            facility_id = request.args.get("facility_id", type=int)
            if facility_id:
                q = q.filter(Redirection.facility_id == facility_id)
            return RedirectionSchema(many=True).dump(q.all())

    @blp_exec.route("/quarters", methods=["GET", "POST"])
    @jwt_required()
    def quarters():
        with SessionLocal() as db:
            if request.method == "POST":
                data = QuarterSchema().load(request.json)

                claims = get_jwt()
                if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                    fid = claims.get("facility_id")
                    if not fid:
                        return {"message": "No facility assigned to user"}, 403
                    data["facility_id"] = int(fid)

                qobj = Quarter(**data)
                db.add(qobj)
                db.commit()
                db.refresh(qobj)
                return QuarterSchema().dump(qobj), 201

            q = db.query(Quarter)
            q = _apply_facility_scope(q, Quarter)

            facility_id = request.args.get("facility_id", type=int)
            year = request.args.get("year", type=int)
            quarter = request.args.get("quarter", type=int)
            if facility_id:
                q = q.filter(Quarter.facility_id == facility_id)
            if year:
                q = q.filter(Quarter.year == year)
            if quarter:
                q = q.filter(Quarter.quarter == quarter)
            return QuarterSchema(many=True).dump(q.all())

    @blp_exec.route("/quarter-lines", methods=["GET", "POST"])
    @jwt_required()
    def quarter_lines():
        with SessionLocal() as db:
            if request.method == "POST":
                data = QuarterLineSchema().load(request.json)
                l = QuarterLine(**data)
                db.add(l)
                db.commit()
                db.refresh(l)
                return QuarterLineSchema().dump(l), 201
            q = db.query(QuarterLine)
            quarter_id = request.args.get("quarter_id", type=int)
            if quarter_id:
                q = q.filter(QuarterLine.quarter_id == quarter_id)
            return QuarterLineSchema(many=True).dump(q.all())

    # ---------- Reports ----------
    def _enforce_facility_param(args):
        """
        For report endpoints that accept facility_id, ensure FACILITY-level
        users cannot query other facilities.
        """
        claims = get_jwt()
        level = claims.get("access_level")
        facility_id_arg = args.get("facility_id")
        if level == AccessLevelEnum.FACILITY.value:
            fid = claims.get("facility_id")
            if not fid:
                raise PermissionError("No facility assigned to user")
            if facility_id_arg and int(facility_id_arg) != int(fid):
                raise PermissionError("Not allowed for this facility")
            return int(fid)
        if facility_id_arg:
            return int(facility_id_arg)
        return None

    @blp_report.route("/summary", methods=["GET"])
    @jwt_required()
    def report_summary():
        args = request.args
        with SessionLocal() as db:
            try:
                facility_id = _enforce_facility_param(args)
            except PermissionError as e:
                return {"message": str(e)}, 403
            data = build_summary_report(db, facility_id, int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/statement", methods=["GET"])
    @jwt_required()
    def report_statement():
        args = request.args
        with SessionLocal() as db:
            try:
                facility_id = _enforce_facility_param(args)
            except PermissionError as e:
                return {"message": str(e)}, 403
            data = build_statement_report(db, facility_id, int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/bank-recon", methods=["GET"])
    @jwt_required()
    def report_bank():
        args = request.args
        with SessionLocal() as db:
            try:
                facility_id = _enforce_facility_param(args)
            except PermissionError as e:
                return {"message": str(e)}, 403
            data = build_bank_recon(db, facility_id, int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/hrh", methods=["GET"])
    @jwt_required()
    def report_hrh():
        args = request.args
        with SessionLocal() as db:
            try:
                facility_id = _enforce_facility_param(args)
            except PermissionError as e:
                return {"message": str(e)}, 403
            data = build_hrh_report(db, facility_id, int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    @blp_report.route("/reallocation", methods=["GET"])
    @jwt_required()
    def report_reallocation():
        args = request.args
        with SessionLocal() as db:
            try:
                facility_id = _enforce_facility_param(args)
            except PermissionError as e:
                return {"message": str(e)}, 403
            data = build_reallocation_report(db, facility_id, int(args["year"]), int(args["quarter"]))
            return jsonify(data)

    # ---- Accounts ----
    @blp_cashbook.route("/accounts", methods=["GET"])
    @jwt_required()
    def list_accounts():
        q = request.args.get("q", type=str)
        hospital_id = request.args.get("hospital_id", type=int)
        facility_id = request.args.get("facility_id", type=int)
        page = request.args.get("page", default=0, type=int)
        page_size = request.args.get("page_size", default=1000, type=int)

        with get_session() as sess:
            bal = _balance_subq()
            query = sess.query(Account, bal.label("current_balance"))

            query = _apply_facility_scope(query, Account)

            if q:
                query = query.filter(Account.name.ilike(f"%{q}%"))
            if hospital_id:
                query = query.filter(Account.hospital_id == hospital_id)
            if facility_id:
                query = query.filter(Account.facility_id == facility_id)

            total = query.count()
            items = (
                query.order_by(Account.name.asc())
                .offset(page * page_size)
                .limit(page_size)
                .all()
            )

            payload = []
            for acc, balance in items:
                data = read_account_schema.dump(acc)
                data["current_balance"] = str(balance or 0)
                payload.append(data)

            return jsonify({"items": payload, "total": total})

    @blp_cashbook.route("/accounts/<int:account_id>", methods=["GET", "OPTIONS"])
    @jwt_required()
    def get_account(account_id: int):
        with get_session() as sess:
            bal = _balance_subq()
            query = sess.query(Account, bal.label("current_balance")).filter(Account.id == account_id)
            query = _apply_facility_scope(query, Account)

            row = query.first()
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

        claims = get_jwt()
        if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
            fid = claims.get("facility_id")
            if not fid:
                return jsonify({"message": "No facility assigned to user"}), 403
            payload["facility_id"] = int(fid)

        with get_session() as sess:
            acc = Account(**payload)
            sess.add(acc)
            sess.flush()
            sess.refresh(acc)
            data = read_account_schema.dump(acc)
            data["current_balance"] = "0"
            return jsonify(data), 201

    @blp_cashbook.route("/accounts/<int:account_id>", methods=["PUT", "PATCH"])
    @jwt_required()
    def update_account(account_id: int):
        payload = update_account_schema.load(request.get_json() or {})

        with get_session() as sess:
            acc = sess.get(Account, account_id)
            if not acc:
                return jsonify({"message": "Not found"}), 404

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if not fid or (acc.facility_id and acc.facility_id != int(fid)):
                    return jsonify({"message": "forbidden for this facility"}), 403

            for k, v in payload.items():
                setattr(acc, k, v)

            sess.flush()
            bal = (
                sess.query(func.coalesce(func.sum((Cashbook.cash_in - Cashbook.cash_out)), 0))
                .filter(Cashbook.account_id == acc.id)
                .scalar()
                or 0
            )

            data = read_account_schema.dump(acc)
            data["current_balance"] = str(bal)
            return jsonify(data)

    @blp_cashbook.route("/accounts/<int:account_id>", methods=["DELETE"])
    @jwt_required()
    def delete_account(account_id: int):
        with get_session() as sess:
            acc = sess.get(Account, account_id)
            if not acc:
                return jsonify({"message": "Not found"}), 404

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if not fid or (acc.facility_id and acc.facility_id != int(fid)):
                    return jsonify({"message": "forbidden for this facility"}), 403

            sess.delete(acc)
            return jsonify({"message": "Deleted"})

    # ---- Cashbook CRUD (new Cashbook table) ----
    @blp_cashbook.route("/cashbooks", methods=["POST"])
    @jwt_required()
    def create_cashbook():
        payload = request.get_json() or {}
        data = create_schema.load(payload)

        claims = get_jwt()
        if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
            fid = claims.get("facility_id")
            if not fid:
                return jsonify({"message": "No facility assigned to user"}), 403
            data["facility_id"] = int(fid)

        with SessionLocal() as sess:
            cb = Cashbook(**data)
            Cashbook.prepare_for_insert(sess, cb)
            sess.add(cb)
            sess.flush()
            Cashbook.recalc_account_balances(sess, cb.account_id)
            sess.commit()
            sess.refresh(cb)
            return read_schema.dump(cb), 201

    @blp_cashbook.route("/cashbooks", methods=["GET"])
    @jwt_required()
    def list_cashbooks():
        q = request.args
        with SessionLocal() as sess:
            stmt = select(Cashbook)

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if fid:
                    stmt = stmt.where(Cashbook.facility_id == int(fid))

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

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if not fid or (cb.facility_id and cb.facility_id != int(fid)):
                    return {"message": "forbidden for this facility"}, 403

            return read_schema.dump(cb), 200

    @blp_cashbook.route("/cashbooks/<int:cb_id>", methods=["PUT", "PATCH"])
    @jwt_required()
    def update_cashbook(cb_id: int):
        payload = request.get_json() or {}
        data = update_schema.load(payload, partial=True)

        with SessionLocal() as sess:
            cb: Cashbook | None = sess.get(Cashbook, cb_id)
            if not cb:
                return {"message": "Not found"}, 404

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if not fid or (cb.facility_id and cb.facility_id != int(fid)):
                    return {"message": "forbidden for this facility"}, 403

            old_account_id = cb.account_id

            for k, v in data.items():
                setattr(cb, k, v)

            if "transaction_date" in data:
                Cashbook.set_quarter(cb)

            sess.flush()

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

            claims = get_jwt()
            if claims.get("access_level") == AccessLevelEnum.FACILITY.value:
                fid = claims.get("facility_id")
                if not fid or (cb.facility_id and cb.facility_id != int(fid)):
                    return {"message": "forbidden for this facility"}, 403

            account_id = cb.account_id
            sess.delete(cb)
            sess.flush()
            Cashbook.recalc_account_balances(sess, account_id)
            sess.commit()
            return {"message": "Deleted"}, 200

    # Register blueprints
    api.register_blueprint(blp_geo)
    api.register_blueprint(blp_budget)
    api.register_blueprint(blp_exec)
    api.register_blueprint(blp_report)
    api.register_blueprint(blp_auth)
    api.register_blueprint(blp_cashbook)
    api.register_blueprint(blp_admin)  # ✅ NEW

    # Health & JWT debug
    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/debug/jwt")
    @jwt_required(optional=True)
    def debug_jwt():
        claims = {}
        try:
            claims = get_jwt()
        except Exception:
            pass
        return {
            "has_SECRET_KEY": bool(app.config.get("SECRET_KEY")),
            "has_JWT_SECRET_KEY": bool(app.config.get("JWT_SECRET_KEY")),
            "JWT_ALGORITHM": app.config.get("JWT_ALGORITHM", "HS256"),
            "claims": {
                "access_level": claims.get("access_level"),
                "country_id": claims.get("country_id"),
                "hospital_id": claims.get("hospital_id"),
                "facility_id": claims.get("facility_id"),
            } if claims else {},
        }

    @app.route("/import/hierarchy", methods=["POST"])
    def import_hierarchy():
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]

        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type"}), 400

        try:
            df = pd.read_excel(file, dtype=str).fillna("")
        except Exception as e:
            return jsonify({"error": f"Failed to read Excel: {str(e)}"}), 400

        sess = SessionLocal()

        imported = {
            "countries": 0,
            "provinces": 0,
            "districts": 0,
            "hospitals": 0,
            "facilities": 0,
        }

        try:
            for _, row in df.iterrows():

                # country = get_or_create_country(
                #     sess,
                #     row["Country"],
                #     row["Country Code"],
                # )

                country = get_or_create_country(
                    sess,
                    "RWANDA",
                    "RW",
                )

                province = get_or_create_province(
                    sess,
                    row["PROVINCE NAME"],
                    row["PROVINCE CODE"],
                    country.id,
                )

                district = get_or_create_district(
                    sess,
                    row["DISTRICT NAME"],
                    row["DISTRICT CODE"],
                    province.id,
                )

                hospital = get_or_create_hospital(
                        sess,
                        row["DISTRICT HOSPITAL CODE"],
                        row["DISTRICT HOSPITAL NAME"],
                        "District Hospital",
                        province.id,
                        district.id,
                    )
                facility = get_or_create_facility(
                        sess,
                        row["HEALTH CENTRE NAME"],
                        row["HEALTH CENTRE CODE"],
                        "Health Centre",
                        country.id,
                        province.id,
                        district.id,
                        referral_hospital_id=hospital.id if hospital else None,
                    )
            sess.commit()

        except IntegrityError as e:
            sess.rollback()
            return jsonify({"error": "Database integrity error", "details": str(e)}), 400

        except Exception as e:
            sess.rollback()
            return jsonify({"error": "Import failed", "details": str(e)}), 500

        finally:
            sess.close()

        return jsonify({"status": "success", "message": "Hierarchy imported successfully"})

    @app.route("/admin/create-facility-users", methods=["POST"])
    def create_facility_users():
        sess = SessionLocal()
        try:
            result = create_users_for_all_facilities(sess)
            return jsonify({"status": "success", "result": result})
        except Exception as e:
            sess.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            sess.close()

    return app
