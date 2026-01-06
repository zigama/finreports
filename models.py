from datetime import datetime, date
from werkzeug.security import generate_password_hash, check_password_hash
from decimal import Decimal
from sqlalchemy import (
    Integer,
    String,
    Enum,
    ForeignKey,
    Date,
    Numeric,
    Float,
    Text,
    DateTime,
    func,
    UniqueConstraint,
    Index,
    select,
    and_,
    CheckConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session
import enum
from typing import Optional
import re


class Base(DeclarativeBase):
    pass


# --- Facility levels (hospitals / health centres) ---

class FacilityLevelEnum(str, enum.Enum):
    NATIONAL_REFERRAL = "National Referral Hospital"
    PROVINCIAL_REFERRAL = "Province Referral Hospital"
    DISTRICT_HOSPITAL = "District Hospital"
    HEALTH_CENTRE = "Health Centre"


# --- Geo ---

class Country(Base):
    __tablename__ = "country"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)

    provinces: Mapped[list["Province"]] = relationship(
        "Province", back_populates="country", cascade="all,delete-orphan"
    )


class Province(Base):
    __tablename__ = "province"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    country_id: Mapped[int] = mapped_column(ForeignKey("country.id"), nullable=False)

    country: Mapped[Country] = relationship("Country", back_populates="provinces")
    districts: Mapped[list["District"]] = relationship(
        "District", back_populates="province", cascade="all,delete-orphan"
    )


class District(Base):
    __tablename__ = "district"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    province_id: Mapped[int] = mapped_column(ForeignKey("province.id"), nullable=False)

    province: Mapped[Province] = relationship("Province", back_populates="districts")


class Hospital(Base):
    __tablename__ = "hospital"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    level: Mapped[FacilityLevelEnum] = mapped_column(Enum(FacilityLevelEnum), nullable=False)
    province_id: Mapped[int] = mapped_column(ForeignKey("province.id"), nullable=False)
    district_id: Mapped[int] = mapped_column(ForeignKey("district.id"), nullable=False)

    province: Mapped[Province] = relationship()
    district: Mapped[District] = relationship()


class Facility(Base):
    __tablename__ = "facility"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    level: Mapped[FacilityLevelEnum] = mapped_column(Enum(FacilityLevelEnum), nullable=False)

    country_id: Mapped[int] = mapped_column(ForeignKey("country.id"), nullable=False)
    province_id: Mapped[int] = mapped_column(ForeignKey("province.id"), nullable=False)
    district_id: Mapped[int] = mapped_column(ForeignKey("district.id"), nullable=False)
    referral_hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospital.id"), nullable=True)

    country: Mapped[Country] = relationship()
    province: Mapped[Province] = relationship()
    district: Mapped[District] = relationship()
    referral_hospital: Mapped[Hospital] = relationship()


# --- Budget catalogue ---

class BudgetLine(Base):
    __tablename__ = "budget_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    activities: Mapped[list["Activity"]] = relationship(
        "Activity",
        back_populates="budget_line",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<BudgetLine {self.code} - {self.name}>"


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    budget_line_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("budget_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    budget_line: Mapped["BudgetLine"] = relationship("BudgetLine", back_populates="activities")

    __table_args__ = (
        Index("ix_activity_unique_per_line", "budget_line_id", "code", unique=True),
    )

    def __repr__(self):
        return f"<Activity {self.code} - {self.name}>"


# --- Budget records ---

class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    hospital_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hospital.id"), index=True)
    facility_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("facility.id"), index=True)
    budget_line_id: Mapped[int] = mapped_column(Integer, ForeignKey("budget_lines.id"), nullable=False, index=True)
    activity_id: Mapped[int] = mapped_column(Integer, ForeignKey("activities.id"), nullable=False, index=True)

    activity_description: Mapped[str | None] = mapped_column(Text)
    level: Mapped[str | None] = mapped_column(String(64), index=True)

    estimated_number_quantity: Mapped[float | None] = mapped_column(Float)
    estimated_frequency_occurrence: Mapped[float | None] = mapped_column(Float)

    unit_price_usd: Mapped[Numeric | None] = mapped_column(Numeric(14, 2))
    cost_per_unit_rwf: Mapped[Numeric | None] = mapped_column(Numeric(14, 2))

    percent_effort_share: Mapped[float | None] = mapped_column(Float)

    component_1: Mapped[Numeric | None] = mapped_column(Numeric(14, 2))
    component_2: Mapped[Numeric | None] = mapped_column(Numeric(14, 2))
    component_3: Mapped[Numeric | None] = mapped_column(Numeric(14, 2))
    component_4: Mapped[Numeric | None] = mapped_column(Numeric(14, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    budget_line: Mapped["BudgetLine"] = relationship("BudgetLine")
    activity: Mapped["Activity"] = relationship("Activity")

    def __repr__(self):
        return f"<Budget id={self.id} BL={self.budget_line_id} ACT={self.activity_id}>"


# --- Quarter, cashbook entry, obligations etc (old model) ---

class Quarter(Base):
    __tablename__ = "quarter"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..4
    reporting_period: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str | None] = mapped_column(String(50))

    facility = relationship("Facility")


class QuarterLine(Base):
    __tablename__ = "quarter_line"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quarter_id: Mapped[int] = mapped_column(ForeignKey("quarter.id"), nullable=False)
    planned: Mapped[float | None] = mapped_column(Numeric(16, 2))
    actual: Mapped[float | None] = mapped_column(Numeric(16, 2))
    variance: Mapped[float | None] = mapped_column(Numeric(16, 2))
    comments: Mapped[str | None] = mapped_column(Text)

    quarter = relationship("Quarter")


class CashbookEntry(Base):
    __tablename__ = "cashbook_entry"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)
    txn_date: Mapped[Date] = mapped_column(Date)
    reference: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(400))
    inflow: Mapped[float | None] = mapped_column(Numeric(16, 2))
    outflow: Mapped[float | None] = mapped_column(Numeric(16, 2))
    balance: Mapped[float | None] = mapped_column(Numeric(16, 2))

    facility = relationship("Facility")


class Obligation(Base):
    __tablename__ = "obligation"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)
    vendor: Mapped[str | None] = mapped_column(String(200))
    invoice_no: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(400))
    amount: Mapped[float | None] = mapped_column(Numeric(16, 2))
    status: Mapped[str | None] = mapped_column(String(50))

    facility = relationship("Facility")


class Reallocation(Base):
    __tablename__ = "reallocation"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"), nullable=False)
    date: Mapped[Date | None] = mapped_column(Date)
    from_budget_line_id: Mapped[int | None] = mapped_column(ForeignKey("budget_lines.id"))
    to_budget_line_id: Mapped[int | None] = mapped_column(ForeignKey("budget_lines.id"))
    amount: Mapped[float | None] = mapped_column(Numeric(16, 2))
    reason: Mapped[str | None] = mapped_column(Text)


class Redirection(Base):
    __tablename__ = "redirection"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"), nullable=False)
    date: Mapped[Date | None] = mapped_column(Date)
    from_component: Mapped[str | None] = mapped_column(String(120))
    to_component: Mapped[str | None] = mapped_column(String(120))
    amount: Mapped[float | None] = mapped_column(Numeric(16, 2))
    reason: Mapped[str | None] = mapped_column(Text)


# ---- Enums ----

class VATRequirementEnum(enum.Enum):
    REQUIRED = "VAT_REQUIRED"
    NOT_REQUIRED = "VAT_NOT_REQUIRED"


class QuarterEnum(enum.Enum):
    Q1 = "Q1"  # Oct-Dec
    Q2 = "Q2"  # Jan-Mar
    Q3 = "Q3"  # Apr-Jun
    Q4 = "Q4"  # Jul-Sep


class AccountTypeEnum(enum.Enum):
    BANK = "BANK"
    MOBILE_MONEY = "MOBILE_MONEY"
    CASH = "CASH"


class AccessLevelEnum(str, enum.Enum):
    COUNTRY = "COUNTRY"   # can see all data
    PROVINCE = "PROVINCE"  # all data in that province
    DISTRICT = "DISTRICT"
    HOSPITAL = "HOSPITAL" # (reserved for future finer-grain)
    FACILITY = "FACILITY" # restricted to one facility


# ---- Helpers ----

def quarter_from_date(d: date) -> QuarterEnum:
    # Fiscal year starts in October
    if d.month in (10, 11, 12):
        return QuarterEnum.Q1
    if d.month in (1, 2, 3):
        return QuarterEnum.Q2
    if d.month in (4, 5, 6):
        return QuarterEnum.Q3
    return QuarterEnum.Q4  # (7, 8, 9)


def initials_from_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z]", "", name or "").upper()
    if not cleaned:
        return "XXX"
    parts = re.split(r"[AEIOU]+", cleaned)
    letters = "".join(p[0] for p in parts if p)[:3]
    if len(letters) < 3:
        letters = (cleaned[:3]).ljust(3, "X")
    return letters


# ---- Account ----

class Account(Base):
    __tablename__ = "account"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    type: Mapped[AccountTypeEnum] = mapped_column(Enum(AccountTypeEnum), nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(160))
    account_number: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    mobile_provider: Mapped[Optional[str]] = mapped_column(String(64))

    facility_id: Mapped[int | None] = mapped_column(ForeignKey("facility.id"), nullable=True)
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospital.id"), nullable=True)

    current_balance: Mapped[Optional[Numeric]] = mapped_column(Numeric(14, 2), default=0)

    facility: Mapped[Optional[Facility]] = relationship()
    hospital: Mapped[Optional[Hospital]] = relationship()


# ---- Cashbook ----

class Cashbook(Base):
    __tablename__ = "cashbook"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quarter: Mapped[QuarterEnum] = mapped_column(
        Enum(QuarterEnum), nullable=False, index=True
    )

    hospital_id: Mapped[int | None] = mapped_column(
        ForeignKey("hospital.id"), nullable=True, index=True
    )
    facility_id: Mapped[int | None] = mapped_column(
        ForeignKey("facility.id"), nullable=True, index=True
    )

    account_id: Mapped[int] = mapped_column(
        ForeignKey("account.id"), nullable=False, index=True
    )

    reference: Mapped[str] = mapped_column(
        String(40), unique=True, nullable=False, index=True
    )

    vat_requirement: Mapped[VATRequirementEnum] = mapped_column(
        Enum(VATRequirementEnum), nullable=False
    )

    description: Mapped[str | None] = mapped_column(Text)

    budget_line_id: Mapped[int] = mapped_column(
        ForeignKey("budget_lines.id"), nullable=False, index=True
    )
    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id"), nullable=False, index=True
    )

    cash_in: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    cash_out: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    created_at: Mapped[date] = mapped_column(
        Date, server_default=func.current_date(), nullable=False
    )
    updated_at: Mapped[date] = mapped_column(
        Date,
        server_default=func.current_date(),
        onupdate=func.current_date(),
        nullable=False,
    )

    hospital: Mapped[Hospital | None] = relationship()
    facility: Mapped[Facility | None] = relationship()
    account: Mapped[Account] = relationship()
    budget_line: Mapped[BudgetLine] = relationship()
    activity: Mapped[Activity] = relationship()

    __table_args__ = (
        CheckConstraint(
            "(cash_in IS NULL) != (cash_out IS NULL)",
            name="ck_cash_in_xor_cash_out",
        ),
        CheckConstraint(
            "(cash_in IS NULL OR cash_in >= 0) "
            "AND (cash_out IS NULL OR cash_out >= 0)",
            name="ck_cash_amounts_positive",
        ),
        CheckConstraint(
            "(hospital_id IS NOT NULL) OR (facility_id IS NOT NULL)",
            name="ck_org_one_present",
        ),
    )

    @classmethod
    def _quarter_from_date(cls, dt: date) -> str:
        if dt is None:
            raise ValueError("transaction_date is required to determine quarter")
        m = dt.month
        if 1 <= m <= 3:
            return "Q2"
        if 4 <= m <= 6:
            return "Q3"
        if 7 <= m <= 9:
            return "Q4"
        return "Q1"

    @classmethod
    def set_quarter(cls, cb: "Cashbook") -> None:
        if cb.transaction_date is None:
            raise ValueError("transaction_date is required to determine quarter")

        q_code = cls._quarter_from_date(cb.transaction_date)

        try:
            cb.quarter = QuarterEnum[q_code]
        except KeyError:
            cb.quarter = QuarterEnum(q_code)

    @classmethod
    def prepare_for_insert(cls, sess: Session, cb: "Cashbook") -> None:
        if cb.quarter is None:
            cls.set_quarter(cb)
        elif isinstance(cb.quarter, str):
            try:
                cb.quarter = QuarterEnum[cb.quarter]
            except KeyError:
                cb.quarter = QuarterEnum(cb.quarter)

        if not cb.reference:
            cb.reference = cls._generate_reference(sess, cb)

        if cb.balance is None:
            last = (
                sess.query(cls)
                .filter(cls.account_id == cb.account_id)
                .order_by(cls.transaction_date.desc(), cls.id.desc())
                .first()
            )

            prev = Decimal(last.balance) if last else Decimal("0")
            ci = Decimal(cb.cash_in or 0)
            co = Decimal(cb.cash_out or 0)

            cb.balance = prev + ci - co

    @classmethod
    def recalc_account_balances(cls, sess: Session, account_id: int) -> None:
        rows: list[Cashbook] = (
            sess.query(cls)
            .filter(cls.account_id == account_id)
            .order_by(cls.transaction_date.asc(), cls.id.asc())
            .all()
        )

        running = Decimal("0")
        for r in rows:
            ci = Decimal(r.cash_in or 0)
            co = Decimal(r.cash_out or 0)
            running += ci - co
            r.balance = running

    @classmethod
    def _generate_reference(cls, sess: Session, cb: "Cashbook") -> str:
        prefix = "CBK"
        d = cb.transaction_date.strftime("%Y%m%d")
        count = (
            sess.query(cls)
            .filter(
                cls.account_id == cb.account_id,
                cls.transaction_date == cb.transaction_date,
            )
            .count()
        )
        return f"{prefix}-{d}-{count + 1:04d}"


# ---- Users & auth ----

class User(Base):
    __tablename__ = "auth_user"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    access_level: Mapped[AccessLevelEnum] = mapped_column(
        Enum(AccessLevelEnum),
        nullable=False,
        default=AccessLevelEnum.FACILITY,
    )
    country_id: Mapped[int | None] = mapped_column(ForeignKey("country.id"), nullable=True)
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospital.id"), nullable=True)
    facility_id: Mapped[int | None] = mapped_column(ForeignKey("facility.id"), nullable=True)

    country: Mapped[Country | None] = relationship("Country")
    hospital: Mapped[Hospital | None] = relationship("Hospital")
    facility: Mapped[Facility | None] = relationship("Facility")

    def set_password(self, raw: str):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        return check_password_hash(self.password_hash, raw)


class TokenBlocklist(Base):
    __tablename__ = "token_blocklist"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jti: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)  # JWT ID
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("jti", name="uq_tokenblocklist_jti"),)
