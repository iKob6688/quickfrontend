import base64
import hashlib
import hmac
import json
import logging
import urllib.request
from datetime import timedelta

from odoo import fields, http
from odoo.http import request
from odoo.tools import consteq
from werkzeug.exceptions import Forbidden
from werkzeug.utils import redirect

_logger = logging.getLogger(__name__)


class OpenClawController(http.Controller):
    def _json_error(self, message, status=400):
        return request.make_json_response({"ok": False, "error": message}, status=status)

    def _get_session(self, channel, chat_user_id):
        return request.env["openclaw.session"].sudo().get_or_create(channel, chat_user_id)

    def _line_signature_ok(self, body, signature):
        secret = request.env["ir.config_parameter"].sudo().get_param("adt_openclaw.line_channel_secret")
        if not secret:
            return False
        digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
        expected = base64.b64encode(digest).decode()
        return consteq(expected, signature or "")

    @http.route("/adt_openclaw/line/webhook", methods=["POST"], type="http", auth="public", csrf=False)
    def line_webhook(self, **kwargs):
        body = request.httprequest.get_data() or b""
        signature = request.httprequest.headers.get("X-Line-Signature")
        if not self._line_signature_ok(body, signature):
            raise Forbidden("Invalid LINE signature")
        payload = json.loads(body.decode("utf-8"))
        events = payload.get("events", [])
        for event in events:
            source = event.get("source", {})
            chat_user_id = source.get("userId") or source.get("groupId") or source.get("roomId")
            if not chat_user_id:
                continue
            text = event.get("message", {}).get("text", "")
            session = self._get_session("line", chat_user_id)
            response = request.env["openclaw.command.router"].sudo().route_message(session, text, payload=event)
            reply_token = event.get("replyToken")
            if reply_token:
                request.env["openclaw.line.adapter"].sudo().reply_message(reply_token, response)
        return request.make_response("OK")

    @http.route("/adt_openclaw/web/inbound", methods=["POST"], type="json", auth="public", csrf=False)
    def web_inbound(self):
        data = request.jsonrequest or {}
        chat_user_id = data.get("chat_user_id")
        text = data.get("text", "")
        if not chat_user_id:
            return {"ok": False, "error": "chat_user_id is required"}
        session = self._get_session("web", chat_user_id)
        response = request.env["openclaw.command.router"].sudo().route_message(session, text, payload=data.get("meta", {}))
        return {"ok": True, "response": request.env["openclaw.web.adapter"].sudo().to_web_payload(response)}

    def _auth_local(self, dbname, login, password):
        uid = False
        methods = [
            lambda: request.session.authenticate(dbname, login, password),
            lambda: request.session.authenticate(dbname, {"login": login, "password": password}),
            lambda: request.session.authenticate(dbname, login, password, {}),
        ]
        for method in methods:
            try:
                uid = method()
                if uid:
                    return uid
            except Exception:
                continue
        return False

    def _jsonrpc_call(self, base_url, service, method, args):
        endpoint = f"{base_url.rstrip('/')}/jsonrpc"
        body = {"jsonrpc": "2.0", "method": "call", "params": {"service": service, "method": method, "args": args}, "id": 1}
        req = urllib.request.Request(
            endpoint, data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        if data.get("error"):
            raise ValueError(data["error"])
        return data.get("result")

    @http.route("/adt_openclaw/session/bind", methods=["POST"], type="json", auth="public", csrf=False)
    def session_bind(self):
        data = request.jsonrequest or {}
        channel = data.get("channel")
        chat_user_id = data.get("chat_user_id")
        dbname = data.get("dbname")
        login = data.get("login")
        password = data.get("password_or_api_key")
        base_url = data.get("odoo_base_url") or request.env["ir.config_parameter"].sudo().get_param("web.base.url")
        if not all([channel, chat_user_id, dbname, login, password]):
            return {"ok": False, "error": "channel, chat_user_id, dbname, login, password_or_api_key are required"}
        uid = False
        company_ids = []
        company_id = False
        if dbname == request.db:
            uid = self._auth_local(dbname, login, password)
            if uid:
                user = request.env["res.users"].sudo().browse(uid)
                company_ids = user.company_ids.ids
                company_id = user.company_id.id
        else:
            uid = self._jsonrpc_call(base_url, "common", "authenticate", [dbname, login, password, {}])
        if not uid:
            return {"ok": False, "error": "authentication failed"}
        session = self._get_session(channel, chat_user_id)
        session.write(
            {
                "odoo_base_url": base_url,
                "odoo_db": dbname,
                "odoo_uid": uid if dbname == request.db else False,
                "odoo_login": login,
                "company_id": company_id,
                "allowed_company_ids": [(6, 0, company_ids)],
                "state": "bound",
                "last_seen": fields.Datetime.now(),
                "expires_at": fields.Datetime.now() + timedelta(hours=12),
                "auth_ref": hashlib.sha256(f"{channel}:{chat_user_id}:{uid}:{dbname}".encode("utf-8")).hexdigest()[:16],
            }
        )
        request.env["openclaw.audit"].sudo().log_event(
            "odoo_action",
            session=session,
            request_data={"op": "bind", "channel": channel, "chat_user_id": chat_user_id, "dbname": dbname, "login": login},
            response_data={"uid": uid, "company_ids": company_ids},
            model="res.users",
            method="authenticate",
            res_ids=[uid] if dbname == request.db else [],
        )
        return {"ok": True, "uid": uid, "companies": company_ids, "message": "session bound"}

    @http.route("/adt_openclaw/admin/verify", methods=["POST"], type="json", auth="public", csrf=False)
    def admin_verify(self):
        data = request.jsonrequest or {}
        channel = data.get("channel")
        chat_user_id = data.get("chat_user_id")
        otp_or_password = data.get("otp_or_password")
        if not all([channel, chat_user_id]):
            return {"ok": False, "error": "channel and chat_user_id are required"}
        session = request.env["openclaw.session"].sudo().search(
            [("channel", "=", channel), ("chat_user_id", "=", chat_user_id)], limit=1
        )
        if not session or not session.odoo_uid:
            return {"ok": False, "error": "bind local Odoo session first"}
        allowed_logins = {
            x.strip()
            for x in request.env["ir.config_parameter"].sudo().get_param("adt_openclaw.admin_logins", "").split(",")
            if x.strip()
        }
        user = session.odoo_uid
        if allowed_logins and user.login not in allowed_logins:
            return {"ok": False, "error": "user login not allowlisted for admin scope"}
        if not user.has_group("adt_openclaw.group_openclaw_admin"):
            return {"ok": False, "error": "user is not in OpenClaw Admin group"}
        verify_hash = request.env["ir.config_parameter"].sudo().get_param("adt_openclaw.admin_verify_code_hash")
        if verify_hash:
            candidate = hashlib.sha256((otp_or_password or "").encode("utf-8")).hexdigest()
            if not consteq(candidate, verify_hash):
                return {"ok": False, "error": "invalid admin verification code"}
        admin = request.env["openclaw.command.router"].sudo().start_admin_session(session, minutes=10)
        request.env["openclaw.audit"].sudo().log_event(
            "os_action",
            session=session,
            admin_session=admin,
            request_data={"action": "admin_verify", "chat_user_id": chat_user_id},
            response_data={"verified": True, "expires_at": admin.expires_at},
        )
        return {"ok": True, "verified": True, "expires_at": admin.expires_at}

    @http.route("/adt_openclaw/go/<string:raw_token>", methods=["GET"], type="http", auth="public", csrf=False)
    def go_token(self, raw_token, **kwargs):
        try:
            token = request.env["openclaw.share_token"].sudo().consume_raw_token(raw_token)
        except Exception as err:
            _logger.warning("OpenClaw go token denied: %s", err)
            return request.not_found()
        request.session.db = token.dbname
        request.session.uid = token.uid.id
        ctx = dict(request.session.context or {})
        if token.company_id:
            ctx.update({"allowed_company_ids": [token.company_id.id], "company_id": token.company_id.id})
        request.session.context = ctx
        request.update_env(user=token.uid.id)
        request.env["openclaw.audit"].sudo().log_event(
            "link_click",
            session=token.session_id,
            request_data={"purpose": token.purpose},
            response_data={"redirect_url": token.redirect_url},
        )
        return redirect(token.redirect_url)

    @http.route("/adt_openclaw/att/<int:attachment_id>", methods=["GET"], type="http", auth="user", csrf=False)
    def stream_attachment(self, attachment_id, download=1, **kwargs):
        attachment = request.env["ir.attachment"].browse(attachment_id)
        attachment.check_access_rights("read")
        attachment.check_access_rule("read")
        if not attachment.datas:
            return request.not_found()
        content = base64.b64decode(attachment.datas)
        filename = attachment.name or f"attachment_{attachment.id}"
        headers = [("Content-Type", attachment.mimetype or "application/octet-stream")]
        if str(download) == "1":
            headers.append(("Content-Disposition", f'attachment; filename="{filename}"'))
        return request.make_response(content, headers=headers)

