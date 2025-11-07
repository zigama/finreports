# auth.py
from datetime import timedelta

from flask_smorest import Blueprint
from flask import jsonify, request, current_app
from flask_jwt_extended import (
    JWTManager, jwt_required, get_jwt, create_access_token, verify_jwt_in_request
)

from models import TokenBlocklist, User  # make sure these exist in models.py

blp_auth = Blueprint("auth", __name__, url_prefix="/auth", description="Authentication")

def init_jwt(app):
    # 8h tokens by default; you can override via env before init
    app.config.setdefault("JWT_ACCESS_TOKEN_EXPIRES", timedelta(hours=8))
    # Use SECRET_KEY as fallback if JWT_SECRET_KEY not provided
    app.config.setdefault("JWT_SECRET_KEY", app.config.get("JWT_SECRET_KEY") or app.config.get("SECRET_KEY"))

    jwt = JWTManager(app)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        # Use the session factory attached in create_app()
        session_factory = app.session_factory
        jti = jwt_payload.get("jti")
        if not jti:
            return True  # treat as revoked if missing
        with session_factory() as db:
            return db.query(TokenBlocklist).filter_by(jti=jti).first() is not None

    return jwt

@blp_auth.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return {"message": "username and password are required"}, 400

    SessionLocal = current_app.session_factory
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.check_password(password):
            return {"message": "invalid credentials"}, 401

        claims = {"role": user.role or "viewer", "username": user.username}
        token = create_access_token(identity=str(user.id), additional_claims=claims)
        return {"access_token": token}, 200

@blp_auth.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Revoke the current access token."""
    session_factory = current_app.session_factory
    jti = get_jwt().get("jti")
    if not jti:
        return {"message": "invalid token"}, 400
    with session_factory() as db:
        db.add(TokenBlocklist(jti=jti))
        db.commit()
    return jsonify({"msg": "Logged out"}), 200

def require_role(*roles):
    """Optional decorator for role checks on a per-route basis."""
    def decorator(fn):
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            if roles:
                claims = get_jwt()
                if claims.get("role") not in roles:
                    return {"message": "forbidden"}, 403
            return fn(*args, **kwargs)
        wrapper.__name__ = fn.__name__
        return wrapper
    return decorator
