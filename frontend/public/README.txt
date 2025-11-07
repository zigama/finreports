Place your moh.svg logo in this folder (public/moh.svg).

CREATE DATABASE
===================

CREATE DATABASE financial_reporting;
CREATE ROLE rbc WITH LOGIN PASSWORD 'rbcP@ss';
GRANT ALL PRIVILEGES ON DATABASE financial_reporting TO rbc;

psql -hlocalhost -p5433 -Urbc -dfinancial_reporting -W

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
