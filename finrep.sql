--
-- PostgreSQL database dump
--

-- Dumped from database version 14.12
-- Dumped by pg_dump version 14.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accounttypeenum; Type: TYPE; Schema: public; Owner: rbc
--

CREATE TYPE public.accounttypeenum AS ENUM (
    'BANK',
    'MOBILE_MONEY',
    'CASH'
);


ALTER TYPE public.accounttypeenum OWNER TO rbc;

--
-- Name: facilitylevelenum; Type: TYPE; Schema: public; Owner: rbc
--

CREATE TYPE public.facilitylevelenum AS ENUM (
    'NATIONAL_REFERRAL',
    'PROVINCIAL_REFERRAL',
    'DISTRICT_HOSPITAL',
    'HEALTH_CENTRE'
);


ALTER TYPE public.facilitylevelenum OWNER TO rbc;

--
-- Name: quarterenum; Type: TYPE; Schema: public; Owner: rbc
--

CREATE TYPE public.quarterenum AS ENUM (
    'Q1',
    'Q2',
    'Q3',
    'Q4'
);


ALTER TYPE public.quarterenum OWNER TO rbc;

--
-- Name: vatrequirementenum; Type: TYPE; Schema: public; Owner: rbc
--

CREATE TYPE public.vatrequirementenum AS ENUM (
    'REQUIRED',
    'NOT_REQUIRED'
);


ALTER TYPE public.vatrequirementenum OWNER TO rbc;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.account (
    id integer NOT NULL,
    name character varying(160) NOT NULL,
    type public.accounttypeenum NOT NULL,
    bank_name character varying(160),
    account_number character varying(64),
    mobile_provider character varying(64),
    facility_id integer,
    hospital_id integer,
    current_balance numeric(14,2)
);


ALTER TABLE public.account OWNER TO rbc;

--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.account_id_seq OWNER TO rbc;

--
-- Name: account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.account_id_seq OWNED BY public.account.id;


--
-- Name: activities; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.activities (
    id integer NOT NULL,
    budget_line_id integer NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    description text
);


ALTER TABLE public.activities OWNER TO rbc;

--
-- Name: activities_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.activities_id_seq OWNER TO rbc;

--
-- Name: activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.activities_id_seq OWNED BY public.activities.id;


--
-- Name: activity; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.activity (
    id integer NOT NULL,
    budget_line_id integer NOT NULL,
    name character varying(300) NOT NULL,
    start_date date,
    end_date date,
    planned_cost numeric(16,2),
    actual_cost numeric(16,2),
    notes text
);


ALTER TABLE public.activity OWNER TO rbc;

--
-- Name: activity_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.activity_id_seq OWNER TO rbc;

--
-- Name: activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.activity_id_seq OWNED BY public.activity.id;


--
-- Name: auth_user; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.auth_user (
    id integer NOT NULL,
    username character varying(120) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50)
);


ALTER TABLE public.auth_user OWNER TO rbc;

--
-- Name: auth_user_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.auth_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.auth_user_id_seq OWNER TO rbc;

--
-- Name: auth_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.auth_user_id_seq OWNED BY public.auth_user.id;


--
-- Name: budget_line; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.budget_line (
    id integer NOT NULL,
    facility_id integer NOT NULL,
    component character varying(120),
    code character varying(80),
    description character varying(400),
    unit character varying(60),
    unit_cost numeric(16,2),
    quantity numeric(16,2),
    total_cost numeric(16,2)
);


ALTER TABLE public.budget_line OWNER TO rbc;

--
-- Name: budget_line_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.budget_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.budget_line_id_seq OWNER TO rbc;

--
-- Name: budget_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.budget_line_id_seq OWNED BY public.budget_line.id;


--
-- Name: budget_lines; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.budget_lines (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    description text
);


ALTER TABLE public.budget_lines OWNER TO rbc;

--
-- Name: budget_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.budget_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.budget_lines_id_seq OWNER TO rbc;

--
-- Name: budget_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.budget_lines_id_seq OWNED BY public.budget_lines.id;


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.budgets (
    id integer NOT NULL,
    hospital_id integer,
    facility_id integer,
    budget_line_id integer NOT NULL,
    activity_id integer NOT NULL,
    activity_description text,
    level character varying(64),
    estimated_number_quantity double precision,
    estimated_frequency_occurrence double precision,
    unit_price_usd numeric(14,2),
    cost_per_unit_rwf numeric(14,2),
    percent_effort_share double precision,
    component_1 numeric(14,2),
    component_2 numeric(14,2),
    component_3 numeric(14,2),
    component_4 numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.budgets OWNER TO rbc;

--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.budgets_id_seq OWNER TO rbc;

--
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- Name: cashbook; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.cashbook (
    id integer NOT NULL,
    transaction_date date NOT NULL,
    quarter public.quarterenum NOT NULL,
    hospital_id integer,
    facility_id integer,
    account_id integer NOT NULL,
    reference character varying(40) NOT NULL,
    vat_requirement public.vatrequirementenum NOT NULL,
    description text,
    budget_line_id integer NOT NULL,
    activity_id integer NOT NULL,
    cash_in numeric(14,2),
    cash_out numeric(14,2),
    balance numeric(14,2) NOT NULL,
    created_at date DEFAULT CURRENT_DATE NOT NULL,
    updated_at date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT ck_cash_amounts_positive CHECK ((((cash_in IS NULL) OR (cash_in >= (0)::numeric)) AND ((cash_out IS NULL) OR (cash_out >= (0)::numeric)))),
    CONSTRAINT ck_cash_in_xor_cash_out CHECK (((cash_in IS NULL) <> (cash_out IS NULL))),
    CONSTRAINT ck_org_one_present CHECK (((hospital_id IS NOT NULL) OR (facility_id IS NOT NULL)))
);


ALTER TABLE public.cashbook OWNER TO rbc;

--
-- Name: cashbook_entry; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.cashbook_entry (
    id integer NOT NULL,
    facility_id integer NOT NULL,
    year integer NOT NULL,
    quarter integer NOT NULL,
    txn_date date NOT NULL,
    reference character varying(120),
    description character varying(400),
    inflow numeric(16,2),
    outflow numeric(16,2),
    balance numeric(16,2)
);


ALTER TABLE public.cashbook_entry OWNER TO rbc;

--
-- Name: cashbook_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.cashbook_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cashbook_entry_id_seq OWNER TO rbc;

--
-- Name: cashbook_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.cashbook_entry_id_seq OWNED BY public.cashbook_entry.id;


--
-- Name: cashbook_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.cashbook_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cashbook_id_seq OWNER TO rbc;

--
-- Name: cashbook_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.cashbook_id_seq OWNED BY public.cashbook.id;


--
-- Name: country; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.country (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    code character varying(10) NOT NULL
);


ALTER TABLE public.country OWNER TO rbc;

--
-- Name: country_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.country_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.country_id_seq OWNER TO rbc;

--
-- Name: country_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.country_id_seq OWNED BY public.country.id;


--
-- Name: district; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.district (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    code character varying(10) NOT NULL,
    province_id integer NOT NULL
);


ALTER TABLE public.district OWNER TO rbc;

--
-- Name: district_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.district_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.district_id_seq OWNER TO rbc;

--
-- Name: district_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.district_id_seq OWNED BY public.district.id;


--
-- Name: facility; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.facility (
    id integer NOT NULL,
    name character varying(160) NOT NULL,
    code character varying(20) NOT NULL,
    level public.facilitylevelenum NOT NULL,
    country_id integer NOT NULL,
    province_id integer NOT NULL,
    district_id integer NOT NULL,
    referral_hospital_id integer
);


ALTER TABLE public.facility OWNER TO rbc;

--
-- Name: facility_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.facility_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.facility_id_seq OWNER TO rbc;

--
-- Name: facility_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.facility_id_seq OWNED BY public.facility.id;


--
-- Name: hospital; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.hospital (
    id integer NOT NULL,
    name character varying(160) NOT NULL,
    code character varying(20) NOT NULL,
    level public.facilitylevelenum NOT NULL,
    province_id integer NOT NULL,
    district_id integer NOT NULL
);


ALTER TABLE public.hospital OWNER TO rbc;

--
-- Name: hospital_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.hospital_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.hospital_id_seq OWNER TO rbc;

--
-- Name: hospital_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.hospital_id_seq OWNED BY public.hospital.id;


--
-- Name: obligation; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.obligation (
    id integer NOT NULL,
    facility_id integer NOT NULL,
    year integer NOT NULL,
    quarter integer NOT NULL,
    vendor character varying(200),
    invoice_no character varying(120),
    description character varying(400),
    amount numeric(16,2),
    status character varying(50)
);


ALTER TABLE public.obligation OWNER TO rbc;

--
-- Name: obligation_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.obligation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.obligation_id_seq OWNER TO rbc;

--
-- Name: obligation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.obligation_id_seq OWNED BY public.obligation.id;


--
-- Name: province; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.province (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    code character varying(10) NOT NULL,
    country_id integer NOT NULL
);


ALTER TABLE public.province OWNER TO rbc;

--
-- Name: province_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.province_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.province_id_seq OWNER TO rbc;

--
-- Name: province_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.province_id_seq OWNED BY public.province.id;


--
-- Name: quarter; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.quarter (
    id integer NOT NULL,
    facility_id integer NOT NULL,
    year integer NOT NULL,
    quarter integer NOT NULL,
    reporting_period character varying(120),
    status character varying(50)
);


ALTER TABLE public.quarter OWNER TO rbc;

--
-- Name: quarter_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.quarter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quarter_id_seq OWNER TO rbc;

--
-- Name: quarter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.quarter_id_seq OWNED BY public.quarter.id;


--
-- Name: quarter_line; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.quarter_line (
    id integer NOT NULL,
    quarter_id integer NOT NULL,
    planned numeric(16,2),
    actual numeric(16,2),
    variance numeric(16,2),
    comments text
);


ALTER TABLE public.quarter_line OWNER TO rbc;

--
-- Name: quarter_line_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.quarter_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quarter_line_id_seq OWNER TO rbc;

--
-- Name: quarter_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.quarter_line_id_seq OWNED BY public.quarter_line.id;


--
-- Name: reallocation; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.reallocation (
    id integer NOT NULL,
    facility_id integer NOT NULL,
    date date,
    from_budget_line_id integer,
    to_budget_line_id integer,
    amount numeric(16,2),
    reason text
);


ALTER TABLE public.reallocation OWNER TO rbc;

--
-- Name: reallocation_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.reallocation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reallocation_id_seq OWNER TO rbc;

--
-- Name: reallocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.reallocation_id_seq OWNED BY public.reallocation.id;


--
-- Name: redirection; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.redirection (
    id integer NOT NULL,
    facility_id integer NOT NULL,
    date date,
    from_component character varying(120),
    to_component character varying(120),
    amount numeric(16,2),
    reason text
);


ALTER TABLE public.redirection OWNER TO rbc;

--
-- Name: redirection_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.redirection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.redirection_id_seq OWNER TO rbc;

--
-- Name: redirection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.redirection_id_seq OWNED BY public.redirection.id;


--
-- Name: token_blocklist; Type: TABLE; Schema: public; Owner: rbc
--

CREATE TABLE public.token_blocklist (
    id integer NOT NULL,
    jti character varying(36) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.token_blocklist OWNER TO rbc;

--
-- Name: token_blocklist_id_seq; Type: SEQUENCE; Schema: public; Owner: rbc
--

CREATE SEQUENCE public.token_blocklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.token_blocklist_id_seq OWNER TO rbc;

--
-- Name: token_blocklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rbc
--

ALTER SEQUENCE public.token_blocklist_id_seq OWNED BY public.token_blocklist.id;


--
-- Name: account id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.account ALTER COLUMN id SET DEFAULT nextval('public.account_id_seq'::regclass);


--
-- Name: activities id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.activities ALTER COLUMN id SET DEFAULT nextval('public.activities_id_seq'::regclass);


--
-- Name: activity id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.activity ALTER COLUMN id SET DEFAULT nextval('public.activity_id_seq'::regclass);


--
-- Name: auth_user id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.auth_user ALTER COLUMN id SET DEFAULT nextval('public.auth_user_id_seq'::regclass);


--
-- Name: budget_line id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budget_line ALTER COLUMN id SET DEFAULT nextval('public.budget_line_id_seq'::regclass);


--
-- Name: budget_lines id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budget_lines ALTER COLUMN id SET DEFAULT nextval('public.budget_lines_id_seq'::regclass);


--
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- Name: cashbook id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook ALTER COLUMN id SET DEFAULT nextval('public.cashbook_id_seq'::regclass);


--
-- Name: cashbook_entry id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook_entry ALTER COLUMN id SET DEFAULT nextval('public.cashbook_entry_id_seq'::regclass);


--
-- Name: country id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.country ALTER COLUMN id SET DEFAULT nextval('public.country_id_seq'::regclass);


--
-- Name: district id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.district ALTER COLUMN id SET DEFAULT nextval('public.district_id_seq'::regclass);


--
-- Name: facility id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.facility ALTER COLUMN id SET DEFAULT nextval('public.facility_id_seq'::regclass);


--
-- Name: hospital id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.hospital ALTER COLUMN id SET DEFAULT nextval('public.hospital_id_seq'::regclass);


--
-- Name: obligation id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.obligation ALTER COLUMN id SET DEFAULT nextval('public.obligation_id_seq'::regclass);


--
-- Name: province id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.province ALTER COLUMN id SET DEFAULT nextval('public.province_id_seq'::regclass);


--
-- Name: quarter id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.quarter ALTER COLUMN id SET DEFAULT nextval('public.quarter_id_seq'::regclass);


--
-- Name: quarter_line id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.quarter_line ALTER COLUMN id SET DEFAULT nextval('public.quarter_line_id_seq'::regclass);


--
-- Name: reallocation id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.reallocation ALTER COLUMN id SET DEFAULT nextval('public.reallocation_id_seq'::regclass);


--
-- Name: redirection id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.redirection ALTER COLUMN id SET DEFAULT nextval('public.redirection_id_seq'::regclass);


--
-- Name: token_blocklist id; Type: DEFAULT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.token_blocklist ALTER COLUMN id SET DEFAULT nextval('public.token_blocklist_id_seq'::regclass);


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.account (id, name, type, bank_name, account_number, mobile_provider, facility_id, hospital_id, current_balance) FROM stdin;
1	KAGEYO BACI	BANK	EQUITY BANK	123456789	\N	1	1	0.00
\.


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.activities (id, budget_line_id, code, name, description) FROM stdin;
1	1	STAFF-SA-FR	Staff Salaries & Fringes Benefits	NA
2	2	BK-CH	Bank charges	NA
3	3	STAFF-SA-FR	Staff Salaries & Fringes Benefits	NA
4	4	GO-SUP	General Office Supplies	NA
5	5	BK-OP	Bank Operations ( Salaries payment, Declaration,…)	NA
6	2	INT-BROD	Broadband internet for EMR	NA
7	2	COMM	Communication	NA
8	2	EQ-MAINT	Equipment maintenance and repair	NA
9	2	INS	Insurance	NA
10	6	OPBAL	Opening Balance	NA
11	7	TRS-A	Transfer	NA
12	2	PE-M	Conduct  monthly meetings of Peer Educators to validate their performance and discuss challenges encountered	NA
\.


--
-- Data for Name: activity; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.activity (id, budget_line_id, name, start_date, end_date, planned_cost, actual_cost, notes) FROM stdin;
\.


--
-- Data for Name: auth_user; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.auth_user (id, username, password_hash, role) FROM stdin;
1	admin	scrypt:32768:8:1$lRJWfl9fZs7XvVTk$5b83b19c15a9eaea23a9f2c1800612adbefa2fca1ef07b085cf3517a0759f18f48514f09cde365e738c9b63dab54c1a1e0a730d96ded1b52d8a81f1b2b4492f5	admin
\.


--
-- Data for Name: budget_line; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.budget_line (id, facility_id, component, code, description, unit, unit_cost, quantity, total_cost) FROM stdin;
\.


--
-- Data for Name: budget_lines; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.budget_lines (id, code, name, description) FROM stdin;
1	FB	Fringe Benefits	NA
2	OT	Other	NA
3	SW	Salary and wages	NA
4	SUP	Supplies	NA
5	TR	Travel	NA
6	OP-BAL	Opening Balance	NA
7	TRS	Transfer	NA
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.budgets (id, hospital_id, facility_id, budget_line_id, activity_id, activity_description, level, estimated_number_quantity, estimated_frequency_occurrence, unit_price_usd, cost_per_unit_rwf, percent_effort_share, component_1, component_2, component_3, component_4, created_at) FROM stdin;
3	1	1	2	7	Communication: Airtime/month 	Health Centre	1	12	60000.00	60000.00	100	180000.00	180000.00	180000.00	180000.00	2025-11-05 12:10:38.722097+02
2	1	1	2	6	Broadband internet	Health Centre	1	12	192000.00	192000.00	50	288000.00	288000.00	288000.00	288000.00	2025-11-05 10:33:47.170824+02
4	1	1	2	8	Program  Operations & Administrative Expenses	Health Centre	1	6	240000.00	240000.00	60	432000.00	432000.00	432000.00	\N	2025-11-05 12:57:44.412172+02
1	1	1	2	2	Program  Operations & Administrative Expenses	Health Centre	1	12	20000.00	20000.00	100	60000.00	60000.00	60000.00	60000.00	2025-11-05 09:05:20.717144+02
5	1	1	2	9	Program  Operations & Administrative Expenses	Health Centre	1	1	72000.00	72000.00	100	72000.00	\N	\N	\N	2025-11-05 13:35:07.877055+02
\.


--
-- Data for Name: cashbook; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.cashbook (id, transaction_date, quarter, hospital_id, facility_id, account_id, reference, vat_requirement, description, budget_line_id, activity_id, cash_in, cash_out, balance, created_at, updated_at) FROM stdin;
3	2025-11-07	Q1	1	1	1	CBK-20251107-0001	REQUIRED	Opening Account Balance	6	10	7878473.00	\N	7878473.00	2025-11-07	2025-11-07
4	2025-11-07	Q1	1	1	1	CBK-20251107-0002	REQUIRED	Meetings of Peer Educators	2	12	\N	75000.00	7803473.00	2025-11-07	2025-11-07
5	2025-11-07	Q1	1	1	1	CBK-20251107-0003	NOT_REQUIRED	Communication	2	7	\N	180000.00	7623473.00	2025-11-07	2025-11-07
\.


--
-- Data for Name: cashbook_entry; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.cashbook_entry (id, facility_id, year, quarter, txn_date, reference, description, inflow, outflow, balance) FROM stdin;
\.


--
-- Data for Name: country; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.country (id, name, code) FROM stdin;
1	RWANDA	RW
\.


--
-- Data for Name: district; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.district (id, name, code, province_id) FROM stdin;
1	Kayonza	0504	5
\.


--
-- Data for Name: facility; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.facility (id, name, code, level, country_id, province_id, district_id, referral_hospital_id) FROM stdin;
1	Kageyo HC	423	HEALTH_CENTRE	1	5	1	1
\.


--
-- Data for Name: hospital; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.hospital (id, name, code, level, province_id, district_id) FROM stdin;
1	Rwinkwavu	123	DISTRICT_HOSPITAL	5	1
\.


--
-- Data for Name: obligation; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.obligation (id, facility_id, year, quarter, vendor, invoice_no, description, amount, status) FROM stdin;
\.


--
-- Data for Name: province; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.province (id, name, code, country_id) FROM stdin;
1	Kigali City	01	1
2	Southern	02	1
3	Western	03	1
4	Northern	04	1
5	Eastern	05	1
\.


--
-- Data for Name: quarter; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.quarter (id, facility_id, year, quarter, reporting_period, status) FROM stdin;
\.


--
-- Data for Name: quarter_line; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.quarter_line (id, quarter_id, planned, actual, variance, comments) FROM stdin;
\.


--
-- Data for Name: reallocation; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.reallocation (id, facility_id, date, from_budget_line_id, to_budget_line_id, amount, reason) FROM stdin;
\.


--
-- Data for Name: redirection; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.redirection (id, facility_id, date, from_component, to_component, amount, reason) FROM stdin;
\.


--
-- Data for Name: token_blocklist; Type: TABLE DATA; Schema: public; Owner: rbc
--

COPY public.token_blocklist (id, jti, created_at) FROM stdin;
1	7722ea5d-6770-4d40-b617-705173c62a57	2025-11-04 14:46:23.560294+02
2	601363d1-f04b-421f-a073-02e5a99e099a	2025-11-06 14:37:48.366238+02
3	199ae4ff-adb1-4b01-bd00-bd558d3a9aaa	2025-11-06 21:03:06.506328+02
4	8c363b8c-3acd-44b8-80b6-c0bb714e7fe5	2025-11-07 12:15:58.155053+02
\.


--
-- Name: account_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.account_id_seq', 1, true);


--
-- Name: activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.activities_id_seq', 12, true);


--
-- Name: activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.activity_id_seq', 1, false);


--
-- Name: auth_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.auth_user_id_seq', 1, true);


--
-- Name: budget_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.budget_line_id_seq', 1, false);


--
-- Name: budget_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.budget_lines_id_seq', 7, true);


--
-- Name: budgets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.budgets_id_seq', 5, true);


--
-- Name: cashbook_entry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.cashbook_entry_id_seq', 1, false);


--
-- Name: cashbook_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.cashbook_id_seq', 5, true);


--
-- Name: country_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.country_id_seq', 1, true);


--
-- Name: district_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.district_id_seq', 1, true);


--
-- Name: facility_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.facility_id_seq', 1, true);


--
-- Name: hospital_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.hospital_id_seq', 1, true);


--
-- Name: obligation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.obligation_id_seq', 1, false);


--
-- Name: province_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.province_id_seq', 5, true);


--
-- Name: quarter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.quarter_id_seq', 1, false);


--
-- Name: quarter_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.quarter_line_id_seq', 1, false);


--
-- Name: reallocation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.reallocation_id_seq', 1, false);


--
-- Name: redirection_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.redirection_id_seq', 1, false);


--
-- Name: token_blocklist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: rbc
--

SELECT pg_catalog.setval('public.token_blocklist_id_seq', 4, true);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (id);


--
-- Name: auth_user auth_user_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.auth_user
    ADD CONSTRAINT auth_user_pkey PRIMARY KEY (id);


--
-- Name: auth_user auth_user_username_key; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.auth_user
    ADD CONSTRAINT auth_user_username_key UNIQUE (username);


--
-- Name: budget_line budget_line_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budget_line
    ADD CONSTRAINT budget_line_pkey PRIMARY KEY (id);


--
-- Name: budget_lines budget_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: cashbook_entry cashbook_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook_entry
    ADD CONSTRAINT cashbook_entry_pkey PRIMARY KEY (id);


--
-- Name: cashbook cashbook_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook
    ADD CONSTRAINT cashbook_pkey PRIMARY KEY (id);


--
-- Name: country country_code_key; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.country
    ADD CONSTRAINT country_code_key UNIQUE (code);


--
-- Name: country country_name_key; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.country
    ADD CONSTRAINT country_name_key UNIQUE (name);


--
-- Name: country country_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.country
    ADD CONSTRAINT country_pkey PRIMARY KEY (id);


--
-- Name: district district_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.district
    ADD CONSTRAINT district_pkey PRIMARY KEY (id);


--
-- Name: facility facility_code_key; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_code_key UNIQUE (code);


--
-- Name: facility facility_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_pkey PRIMARY KEY (id);


--
-- Name: hospital hospital_code_key; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.hospital
    ADD CONSTRAINT hospital_code_key UNIQUE (code);


--
-- Name: hospital hospital_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.hospital
    ADD CONSTRAINT hospital_pkey PRIMARY KEY (id);


--
-- Name: obligation obligation_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.obligation
    ADD CONSTRAINT obligation_pkey PRIMARY KEY (id);


--
-- Name: province province_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.province
    ADD CONSTRAINT province_pkey PRIMARY KEY (id);


--
-- Name: quarter_line quarter_line_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.quarter_line
    ADD CONSTRAINT quarter_line_pkey PRIMARY KEY (id);


--
-- Name: quarter quarter_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.quarter
    ADD CONSTRAINT quarter_pkey PRIMARY KEY (id);


--
-- Name: reallocation reallocation_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.reallocation
    ADD CONSTRAINT reallocation_pkey PRIMARY KEY (id);


--
-- Name: redirection redirection_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.redirection
    ADD CONSTRAINT redirection_pkey PRIMARY KEY (id);


--
-- Name: token_blocklist token_blocklist_pkey; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.token_blocklist
    ADD CONSTRAINT token_blocklist_pkey PRIMARY KEY (id);


--
-- Name: token_blocklist uq_tokenblocklist_jti; Type: CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.token_blocklist
    ADD CONSTRAINT uq_tokenblocklist_jti UNIQUE (jti);


--
-- Name: ix_account_account_number; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_account_account_number ON public.account USING btree (account_number);


--
-- Name: ix_activities_budget_line_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_activities_budget_line_id ON public.activities USING btree (budget_line_id);


--
-- Name: ix_activities_code; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_activities_code ON public.activities USING btree (code);


--
-- Name: ix_activity_unique_per_line; Type: INDEX; Schema: public; Owner: rbc
--

CREATE UNIQUE INDEX ix_activity_unique_per_line ON public.activities USING btree (budget_line_id, code);


--
-- Name: ix_budget_lines_code; Type: INDEX; Schema: public; Owner: rbc
--

CREATE UNIQUE INDEX ix_budget_lines_code ON public.budget_lines USING btree (code);


--
-- Name: ix_budgets_activity_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_budgets_activity_id ON public.budgets USING btree (activity_id);


--
-- Name: ix_budgets_budget_line_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_budgets_budget_line_id ON public.budgets USING btree (budget_line_id);


--
-- Name: ix_budgets_facility_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_budgets_facility_id ON public.budgets USING btree (facility_id);


--
-- Name: ix_budgets_hospital_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_budgets_hospital_id ON public.budgets USING btree (hospital_id);


--
-- Name: ix_budgets_level; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_budgets_level ON public.budgets USING btree (level);


--
-- Name: ix_cashbook_account_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_cashbook_account_id ON public.cashbook USING btree (account_id);


--
-- Name: ix_cashbook_activity_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_cashbook_activity_id ON public.cashbook USING btree (activity_id);


--
-- Name: ix_cashbook_budget_line_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_cashbook_budget_line_id ON public.cashbook USING btree (budget_line_id);


--
-- Name: ix_cashbook_facility_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_cashbook_facility_id ON public.cashbook USING btree (facility_id);


--
-- Name: ix_cashbook_hospital_id; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_cashbook_hospital_id ON public.cashbook USING btree (hospital_id);


--
-- Name: ix_cashbook_quarter; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_cashbook_quarter ON public.cashbook USING btree (quarter);


--
-- Name: ix_cashbook_reference; Type: INDEX; Schema: public; Owner: rbc
--

CREATE UNIQUE INDEX ix_cashbook_reference ON public.cashbook USING btree (reference);


--
-- Name: ix_cashbook_transaction_date; Type: INDEX; Schema: public; Owner: rbc
--

CREATE INDEX ix_cashbook_transaction_date ON public.cashbook USING btree (transaction_date);


--
-- Name: account account_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: account account_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospital(id);


--
-- Name: activities activities_budget_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_budget_line_id_fkey FOREIGN KEY (budget_line_id) REFERENCES public.budget_lines(id) ON DELETE CASCADE;


--
-- Name: activity activity_budget_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_budget_line_id_fkey FOREIGN KEY (budget_line_id) REFERENCES public.budget_line(id);


--
-- Name: budget_line budget_line_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budget_line
    ADD CONSTRAINT budget_line_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: budgets budgets_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id);


--
-- Name: budgets budgets_budget_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_budget_line_id_fkey FOREIGN KEY (budget_line_id) REFERENCES public.budget_lines(id);


--
-- Name: budgets budgets_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: budgets budgets_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospital(id);


--
-- Name: cashbook cashbook_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook
    ADD CONSTRAINT cashbook_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: cashbook cashbook_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook
    ADD CONSTRAINT cashbook_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id);


--
-- Name: cashbook cashbook_budget_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook
    ADD CONSTRAINT cashbook_budget_line_id_fkey FOREIGN KEY (budget_line_id) REFERENCES public.budget_lines(id);


--
-- Name: cashbook_entry cashbook_entry_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook_entry
    ADD CONSTRAINT cashbook_entry_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: cashbook cashbook_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook
    ADD CONSTRAINT cashbook_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: cashbook cashbook_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.cashbook
    ADD CONSTRAINT cashbook_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospital(id);


--
-- Name: district district_province_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.district
    ADD CONSTRAINT district_province_id_fkey FOREIGN KEY (province_id) REFERENCES public.province(id);


--
-- Name: facility facility_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.country(id);


--
-- Name: facility facility_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.district(id);


--
-- Name: facility facility_province_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_province_id_fkey FOREIGN KEY (province_id) REFERENCES public.province(id);


--
-- Name: facility facility_referral_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_referral_hospital_id_fkey FOREIGN KEY (referral_hospital_id) REFERENCES public.hospital(id);


--
-- Name: hospital hospital_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.hospital
    ADD CONSTRAINT hospital_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.district(id);


--
-- Name: hospital hospital_province_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.hospital
    ADD CONSTRAINT hospital_province_id_fkey FOREIGN KEY (province_id) REFERENCES public.province(id);


--
-- Name: obligation obligation_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.obligation
    ADD CONSTRAINT obligation_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: province province_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.province
    ADD CONSTRAINT province_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.country(id);


--
-- Name: quarter quarter_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.quarter
    ADD CONSTRAINT quarter_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: quarter_line quarter_line_quarter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.quarter_line
    ADD CONSTRAINT quarter_line_quarter_id_fkey FOREIGN KEY (quarter_id) REFERENCES public.quarter(id);


--
-- Name: reallocation reallocation_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.reallocation
    ADD CONSTRAINT reallocation_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- Name: reallocation reallocation_from_budget_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.reallocation
    ADD CONSTRAINT reallocation_from_budget_line_id_fkey FOREIGN KEY (from_budget_line_id) REFERENCES public.budget_line(id);


--
-- Name: reallocation reallocation_to_budget_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.reallocation
    ADD CONSTRAINT reallocation_to_budget_line_id_fkey FOREIGN KEY (to_budget_line_id) REFERENCES public.budget_line(id);


--
-- Name: redirection redirection_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rbc
--

ALTER TABLE ONLY public.redirection
    ADD CONSTRAINT redirection_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(id);


--
-- PostgreSQL database dump complete
--

