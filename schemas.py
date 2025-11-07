# schemas.py
from marshmallow import (Schema, fields, validate, validates_schema
, ValidationError, EXCLUDE)
from marshmallow_enum import EnumField
from models import VATRequirementEnum, QuarterEnum, AccountTypeEnum

FacilityLevelValues = [
    "National Referral Hospital",
    "Province Referral Hospital",
    "District Hospital",
    "Health Centre",
]

class CountrySchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str(required=True)

class ProvinceSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str(required=True)
    country_id = fields.Int(required=True)

class DistrictSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str(required=True)
    province_id = fields.Int(required=True)

class HospitalSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str(required=True)
    level = fields.Str(required=True, validate=validate.OneOf(FacilityLevelValues))
    province_id = fields.Int(required=True)
    district_id = fields.Int(required=True)

class FacilitySchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str(required=True)
    level = fields.Str(required=True, validate=validate.OneOf(FacilityLevelValues))
    country_id = fields.Int(required=True)
    province_id = fields.Int(required=True)
    district_id = fields.Int(required=True)
    referral_hospital_id = fields.Int(allow_none=True)

class BudgetLineSchema(Schema):
    id = fields.Int(dump_only=True)
    code = fields.Str(required=True, validate=validate.Length(min=1, max=64))
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str(allow_none=True)

class ActivitySchema(Schema):
    id = fields.Int(dump_only=True)
    budget_line_id = fields.Int(required=True)
    code = fields.Str(required=True, validate=validate.Length(min=1, max=64))
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str(allow_none=True)


class BudgetSchema(Schema):
    id = fields.Int(dump_only=True)

    hospital_id = fields.Int(allow_none=True)
    facility_id = fields.Int(allow_none=True)
    budget_line_id = fields.Int(required=True)
    activity_id = fields.Int(required=True)

    activity_description = fields.Str(allow_none=True)
    level = fields.Str(allow_none=True, validate=validate.Length(max=64))

    estimated_number_quantity = fields.Float(allow_none=True)
    estimated_frequency_occurrence = fields.Float(allow_none=True)

    unit_price_usd = fields.Decimal(allow_none=True, as_string=True)
    cost_per_unit_rwf = fields.Decimal(allow_none=True, as_string=True)

    percent_effort_share = fields.Float(allow_none=True)

    component_1 = fields.Decimal(allow_none=True, as_string=True)
    component_2 = fields.Decimal(allow_none=True, as_string=True)
    component_3 = fields.Decimal(allow_none=True, as_string=True)
    component_4 = fields.Decimal(allow_none=True, as_string=True)

    created_at = fields.DateTime(dump_only=True)

    @validates_schema
    def validate_refs(self, data, **kwargs):
      # Require at least one of hospital or facility
      if not data.get("hospital_id") and not data.get("facility_id"):
          raise ValidationError("Either hospital_id or facility_id must be provided.")


class QuarterSchema(Schema):
    id = fields.Int(dump_only=True)
    facility_id = fields.Int(required=True)
    year = fields.Int(required=True)
    quarter = fields.Int(required=True)
    reporting_period = fields.Str()
    status = fields.Str()

class QuarterLineSchema(Schema):
    id = fields.Int(dump_only=True)
    quarter_id = fields.Int(required=True)
    budget_line_id = fields.Int()
    planned = fields.Decimal(as_string=True)
    actual = fields.Decimal(as_string=True)
    variance = fields.Decimal(as_string=True)
    comments = fields.Str()

class CashbookEntrySchema(Schema):
    id = fields.Int(dump_only=True)
    facility_id = fields.Int(required=True)
    year = fields.Int(required=True)
    quarter = fields.Int(required=True)
    txn_date = fields.Date(required=True)
    reference = fields.Str()
    description = fields.Str()
    inflow = fields.Decimal(as_string=True)
    outflow = fields.Decimal(as_string=True)
    balance = fields.Decimal(as_string=True)

class ObligationSchema(Schema):
    id = fields.Int(dump_only=True)
    facility_id = fields.Int(required=True)
    year = fields.Int(required=True)
    quarter = fields.Int(required=True)
    vendor = fields.Str()
    invoice_no = fields.Str()
    description = fields.Str()
    amount = fields.Decimal(as_string=True)
    status = fields.Str()

class ReallocationSchema(Schema):
    id = fields.Int(dump_only=True)
    facility_id = fields.Int(required=True)
    date = fields.Date(allow_none=True)
    from_budget_line_id = fields.Int(allow_none=True)
    to_budget_line_id = fields.Int(allow_none=True)
    amount = fields.Decimal(as_string=True)
    reason = fields.Str()

class RedirectionSchema(Schema):
    id = fields.Int(dump_only=True)
    facility_id = fields.Int(required=True)
    date = fields.Date(allow_none=True)
    from_component = fields.Str()
    to_component = fields.Str()
    amount = fields.Decimal(as_string=True)
    reason = fields.Str()

class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    username = fields.Str(required=True)
    role = fields.Str()
    password = fields.Str(load_only=True)  # used for registration/login only


class AccountSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Integer(dump_only=True)
    name = fields.String(required=True)
    type = EnumField(AccountTypeEnum, by_value=True, required=True)
    bank_name = fields.String(allow_none=True)
    account_number = fields.String(allow_none=True)
    mobile_provider = fields.String(allow_none=True)
    facility_id = fields.Integer(allow_none=True)
    hospital_id = fields.Integer(allow_none=True)
    current_balance = fields.Decimal(as_string=True, dump_only=True)


class CashbookCreateSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    transaction_date = fields.Date(required=True)
    hospital_id = fields.Integer(allow_none=True)
    facility_id = fields.Integer(allow_none=True)
    account_id = fields.Integer(required=True)

    vat_requirement = EnumField(VATRequirementEnum, by_value=True, required=True)
    description = fields.String(allow_none=True)

    budget_line_id = fields.Integer(required=True)
    activity_id = fields.Integer(required=True)

    cash_in = fields.Decimal(as_string=True, allow_none=True)
    cash_out = fields.Decimal(as_string=True, allow_none=True)

    # computed
    # balance = fields.Decimal(as_string=True, dump_only=True)

    @validates_schema
    def _xor_cash(self, data, **kwargs):
        if bool(data.get("cash_in")) == bool(data.get("cash_out")):
            raise ValidationError("Provide exactly one of cash_in or cash_out.")
        if not data.get("hospital_id") and not data.get("facility_id"):
            raise ValidationError("Either hospital_id or facility_id must be provided.")



class CashbookUpdateSchema(Schema):
    class Meta:
        unknown = EXCLUDE
    # allow partial updates
    transaction_date = fields.Date()
    hospital_id = fields.Integer(allow_none=True)
    facility_id = fields.Integer(allow_none=True)
    account_id = fields.Integer()

    vat_requirement = EnumField(VATRequirementEnum, by_value=True)
    description = fields.String(allow_none=True)

    budget_line_id = fields.Integer()
    activity_id = fields.Integer()

    cash_in = fields.Decimal(as_string=True, allow_none=True)
    cash_out = fields.Decimal(as_string=True, allow_none=True)

    @validates_schema
    def _xor_cash_if_present(self, data, **kwargs):
        if "cash_in" in data or "cash_out" in data:
            if bool(data.get("cash_in")) == bool(data.get("cash_out")):
                raise ValidationError("Provide exactly one of cash_in or cash_out when updating.")


class CashbookReadSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Integer()
    transaction_date = fields.Date()
    quarter = EnumField(QuarterEnum, by_value=True)
    hospital_id = fields.Integer(allow_none=True)
    facility_id = fields.Integer(allow_none=True)
    account_id = fields.Integer()
    reference = fields.String()
    vat_requirement = EnumField(VATRequirementEnum, by_value=True)
    description = fields.String(allow_none=True)
    budget_line_id = fields.Integer()
    activity_id = fields.Integer()
    cash_in = fields.Decimal(as_string=True, allow_none=True)
    cash_out = fields.Decimal(as_string=True, allow_none=True)
    balance = fields.Decimal(as_string=True)
    created_at = fields.Date()
    updated_at = fields.Date()

class AccountCreateSchema(Schema):
    class Meta: unknown = EXCLUDE
    name = fields.String(required=True)
    type = EnumField(AccountTypeEnum, by_value=True)
    bank_name = fields.String(allow_none=True)
    account_number = fields.String(allow_none=True)
    mobile_provider = fields.String(allow_none=True)
    hospital_id = fields.Integer(allow_none=True)
    facility_id = fields.Integer(allow_none=True)

class AccountUpdateSchema(Schema):
    class Meta: unknown = EXCLUDE
    name = fields.String()
    type = EnumField(AccountTypeEnum, by_value=True)
    bank_name = fields.String(allow_none=True)
    account_number = fields.String(allow_none=True)
    mobile_provider = fields.String(allow_none=True)
    hospital_id = fields.Integer(allow_none=True)
    facility_id = fields.Integer(allow_none=True)

class AccountReadSchema(Schema):
    class Meta: unknown = EXCLUDE
    id = fields.Integer()
    name = fields.String()
    type = EnumField(AccountTypeEnum, by_value=True)
    bank_name = fields.String(allow_none=True)
    account_number = fields.String(allow_none=True)
    mobile_provider = fields.String(allow_none=True)
    hospital_id = fields.Integer(allow_none=True)
    facility_id = fields.Integer(allow_none=True)
    current_balance = fields.Decimal(as_string=True)  # computed
    created_at = fields.DateTime()
    updated_at = fields.DateTime()