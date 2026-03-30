import hashlib
import json
import secrets
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError

from ..services.security_utils import redact_payload


class OpenClawInstance(models.Model):
    _name = "openclaw.instance"
    _description = "OpenClaw Instance"

    name = fields.Char(required=True)
    base_url = fields.Char(required=True)
    is_active = fields.Boolean(default=True)
    shared_secret = fields.Char(
        compute="_compute_shared_secret", inverse="_inverse_shared_secret", groups="base.group_system"
    )
    shared_secret_hash = fields.Char(copy=False, groups="base.group_system")
    health_status = fields.Selection(
        [("unknown", "Unknown"), ("ok", "OK"), ("degraded", "Degraded"), ("down", "Down")],
        default="unknown",
    )
    last_seen = fields.Datetime()
    timeout_seconds = fields.Integer(default=60)

    def _compute_shared_secret(self):
        for rec in self:
            rec.shared_secret = "********" if rec.shared_secret_hash else False

    def _inverse_shared_secret(self):
        for rec in self:
            if rec.shared_secret and rec.shared_secret != "********":
                rec.shared_secret_hash = self._hash_value(rec.shared_secret)
                rec.shared_secret = "********"

    @api.model
    def _hash_value(self, value):
        return hashlib.sha256(value.encode("utf-8")).hexdigest()


class OpenClawSession(models.Model):
    _name = "openclaw.session"
    _description = "OpenClaw Chat Session"
    _order = "last_seen desc"

    channel = fields.Selection([("line", "LINE"), ("web", "Web Chat")], required=True)
    chat_user_id = fields.Char(required=True, index=True)
    odoo_base_url = fields.Char()
    odoo_db = fields.Char()
    odoo_uid = fields.Many2one("res.users")
    odoo_login = fields.Char()
    company_id = fields.Many2one("res.company")
    allowed_company_ids = fields.Many2many("res.company", "openclaw_session_company_rel", "session_id", "company_id")
    state = fields.Selection(
        [("new", "New"), ("bound", "Bound"), ("expired", "Expired"), ("blocked", "Blocked")], default="new", index=True
    )
    last_seen = fields.Datetime(default=fields.Datetime.now)
    expires_at = fields.Datetime(default=lambda self: fields.Datetime.now() + timedelta(hours=12))
    auth_ref = fields.Char(copy=False)

    _sql_constraints = [
        ("openclaw_session_unique_chat", "unique(channel, chat_user_id)", "Session already exists for this chat identity.")
    ]

    @api.model
    def get_or_create(self, channel, chat_user_id):
        session = self.search([("channel", "=", channel), ("chat_user_id", "=", chat_user_id)], limit=1)
        if session:
            session.write({"last_seen": fields.Datetime.now()})
            return session
        return self.create({"channel": channel, "chat_user_id": chat_user_id})

    def is_alive(self):
        self.ensure_one()
        return self.state in ("new", "bound") and self.expires_at and self.expires_at > fields.Datetime.now()

    @api.model
    def cron_expire_sessions(self):
        now = fields.Datetime.now()
        expired = self.search([("state", "in", ("new", "bound")), ("expires_at", "<=", now)])
        expired.write({"state": "expired"})


class OpenClawAdminSession(models.Model):
    _name = "openclaw.admin_session"
    _description = "OpenClaw Admin Session"
    _order = "verified_at desc"

    chat_user_id = fields.Char(required=True, index=True)
    channel = fields.Selection([("line", "LINE"), ("web", "Web Chat")], required=True)
    verified = fields.Boolean(default=False)
    verified_at = fields.Datetime()
    expires_at = fields.Datetime(index=True)
    sudo_mode_enabled = fields.Boolean(default=False)
    audit_count = fields.Integer(default=0)

    _sql_constraints = [
        ("openclaw_admin_unique_chat", "unique(channel, chat_user_id)", "Admin session already exists for this chat identity.")
    ]

    def ensure_active(self):
        self.ensure_one()
        if not self.verified or not self.expires_at or self.expires_at <= fields.Datetime.now():
            raise AccessError(_("Admin verification expired. Please verify again."))
        return True

    @api.model
    def get_or_create(self, channel, chat_user_id):
        rec = self.search([("channel", "=", channel), ("chat_user_id", "=", chat_user_id)], limit=1)
        return rec or self.create({"channel": channel, "chat_user_id": chat_user_id})

    @api.model
    def cron_expire_admin(self):
        now = fields.Datetime.now()
        recs = self.search([("verified", "=", True), ("expires_at", "<=", now)])
        recs.write({"verified": False, "sudo_mode_enabled": False})


class OpenClawAudit(models.Model):
    _name = "openclaw.audit"
    _description = "OpenClaw Audit Log"
    _order = "created_at desc,id desc"

    event_type = fields.Selection(
        [
            ("inbound_message", "Inbound Message"),
            ("assistant_command", "Assistant Command"),
            ("odoo_action", "Odoo Action"),
            ("os_action", "OS Action"),
            ("report_render", "Report Render"),
            ("link_click", "Link Click"),
            ("error", "Error"),
        ],
        required=True,
    )
    session_id = fields.Many2one("openclaw.session")
    admin_session_id = fields.Many2one("openclaw.admin_session")
    request_json = fields.Text()
    response_json = fields.Text()
    model = fields.Char()
    method = fields.Char()
    res_ids = fields.Char()
    os_command_key = fields.Char()
    created_at = fields.Datetime(default=fields.Datetime.now, required=True)

    def unlink(self):
        raise AccessError(_("Audit logs are immutable."))

    def write(self, vals):
        if not self.env.is_superuser():
            raise AccessError(_("Audit logs are immutable."))
        return super().write(vals)

    @api.model
    def log_event(
        self,
        event_type,
        session=None,
        admin_session=None,
        request_data=None,
        response_data=None,
        model=None,
        method=None,
        res_ids=None,
        os_command_key=None,
    ):
        vals = {
            "event_type": event_type,
            "session_id": session.id if session else False,
            "admin_session_id": admin_session.id if admin_session else False,
            "request_json": json.dumps(redact_payload(request_data or {}), ensure_ascii=False),
            "response_json": json.dumps(redact_payload(response_data or {}), ensure_ascii=False),
            "model": model,
            "method": method,
            "res_ids": ",".join(str(x) for x in (res_ids or [])),
            "os_command_key": os_command_key,
        }
        return self.sudo().create(vals)


class OpenClawShareToken(models.Model):
    _name = "openclaw.share_token"
    _description = "OpenClaw Share Token"
    _order = "id desc"

    token = fields.Char(help="Public reference only; raw one-time token is never stored.")
    token_hash = fields.Char(required=True, index=True, copy=False)
    session_id = fields.Many2one("openclaw.session", required=True, ondelete="cascade")
    uid = fields.Many2one("res.users", required=True)
    dbname = fields.Char(required=True)
    company_id = fields.Many2one("res.company")
    purpose = fields.Selection(
        [("report_view", "Report View"), ("attachment_download", "Attachment Download"), ("web_login", "Web Login")],
        required=True,
    )
    redirect_url = fields.Char(required=True)
    expires_at = fields.Datetime(required=True)
    max_uses = fields.Integer(default=1)
    used_count = fields.Integer(default=0)
    state = fields.Selection(
        [("active", "Active"), ("used", "Used"), ("expired", "Expired"), ("revoked", "Revoked")],
        default="active",
        required=True,
    )

    _sql_constraints = [("openclaw_share_token_hash_uniq", "unique(token_hash)", "Token hash must be unique.")]

    @api.model
    def _hash_token(self, raw_token):
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @api.model
    def create_token(self, session, uid, dbname, company_id, purpose, redirect_url, ttl_seconds=180, max_uses=1):
        raw = secrets.token_urlsafe(48)
        token_hash = self._hash_token(raw)
        ref = token_hash[:12]
        rec = self.create(
            {
                "token": ref,
                "token_hash": token_hash,
                "session_id": session.id,
                "uid": uid.id if isinstance(uid, models.BaseModel) else uid,
                "dbname": dbname,
                "company_id": company_id.id if isinstance(company_id, models.BaseModel) else company_id,
                "purpose": purpose,
                "redirect_url": redirect_url,
                "expires_at": fields.Datetime.now() + timedelta(seconds=ttl_seconds),
                "max_uses": max_uses,
            }
        )
        return rec, raw

    def _mark_expired(self):
        self.filtered(lambda t: t.state == "active").write({"state": "expired"})

    def _validate_active(self):
        self.ensure_one()
        now = fields.Datetime.now()
        if self.state != "active":
            raise ValidationError(_("Token is no longer active."))
        if self.expires_at <= now:
            self.write({"state": "expired"})
            raise ValidationError(_("Token expired."))
        if self.used_count >= self.max_uses:
            self.write({"state": "used"})
            raise ValidationError(_("Token already used."))
        return True

    @api.model
    def consume_raw_token(self, raw_token):
        token_hash = self._hash_token(raw_token)
        token = self.sudo().search([("token_hash", "=", token_hash)], limit=1)
        if not token:
            raise ValidationError(_("Invalid token."))
        token._validate_active()
        token.used_count += 1
        if token.used_count >= token.max_uses:
            token.state = "used"
        return token

    @api.model
    def cron_expire_tokens(self):
        now = fields.Datetime.now()
        exp = self.search([("state", "=", "active"), ("expires_at", "<=", now)])
        exp.write({"state": "expired"})
