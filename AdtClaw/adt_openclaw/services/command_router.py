import json
import logging
import shlex
from datetime import timedelta

from odoo import _, fields, models
from odoo.exceptions import AccessError

from .policy import ensure_business_model_allowed, ensure_safe_state_method, is_ai_agent_enabled, normalize_model_name

_logger = logging.getLogger(__name__)


class OpenClawCommandRouter(models.AbstractModel):
    _name = "openclaw.command.router"
    _description = "OpenClaw Command Router"

    def _allowed_models(self):
        raw = self.env["ir.config_parameter"].sudo().get_param("adt_openclaw.allowed_models", "")
        return {x.strip() for x in raw.split(",") if x.strip()}

    def _ensure_model_allowed(self, model, operation="read"):
        normalized = normalize_model_name(model)
        ensure_business_model_allowed(normalized, operation=operation)
        allowlist = self._allowed_models()
        if allowlist and normalized not in allowlist:
            raise AccessError(_("Model is not allowlisted."))
        return normalized

    def _ctx_for_session(self, session):
        company_ids = []
        if hasattr(session, "allowed_company_ids") and session.allowed_company_ids:
            company_ids = session.allowed_company_ids.ids
        if not company_ids and getattr(session, "company_id", False):
            company_ids = [session.company_id.id]
        return {"allowed_company_ids": company_ids}

    def _is_openclaw_session(self, session):
        return bool(getattr(session, "_name", "") == "openclaw.session")

    def _require_bound(self, session):
        if not self._is_openclaw_session(session):
            return
        if session.state != "bound" or not session.odoo_uid:
            raise AccessError(_("Session is not bound to a local Odoo user."))

    def _resolve_admin(self, session):
        return self.env["openclaw.admin_session"].sudo().get_or_create(session.channel, session.chat_user_id)

    def route_message(self, session, text, payload=None):
        payload = payload or {}
        msg = (text or "").strip()
        parts = shlex.split(msg) if msg else []
        cmd = parts[0].lower() if parts else "help"
        args = parts[1:] if len(parts) > 1 else []
        self.env["openclaw.audit"].sudo().log_event("inbound_message", session=session, request_data={"text": msg, "payload": payload})
        if not is_ai_agent_enabled(self.env):
            return {"text": "AI agent is disabled in OpenClaw settings. Enable it to allow assistant execution."}
        if cmd.startswith("os."):
            return self._route_os(session, cmd, args)
        if cmd == "help":
            return self._help()
        if cmd in ("whoami", "session"):
            return self._session_info(session)
        if cmd == "report.generate":
            return self._report_generate(session)
        if cmd == "record.create":
            return self._record_create(session, args)
        if cmd == "record.update":
            return self._record_update(session, args)
        if cmd == "record.search":
            return self._record_search(session, args)
        if cmd == "record.call":
            return self._record_call(session, args)
        if cmd == "record.post":
            return self._record_post(session, args)
        if cmd == "record.confirm":
            return self._record_confirm(session, args)
        return {"text": f"Unknown command: {cmd}. Try `help`."}

    def execute_structured_command(self, session, command, context=None):
        context = context or {}
        if not isinstance(command, dict):
            raise AccessError(_("Structured command must be an object."))
        if not is_ai_agent_enabled(self.env):
            raise AccessError(_("AI agent is disabled in OpenClaw settings. Enable it to allow assistant execution."))
        self._require_bound(session)

        tool_name = str(command.get("tool") or "").strip()
        if not tool_name:
            raise AccessError(_("Structured command tool is required."))
        args = command.get("args") if isinstance(command.get("args"), dict) else {}
        request_id = str(command.get("request_id") or command.get("trace_id") or "").strip() or False
        source = str(command.get("source") or "assistant").strip()
        assistant_session_uid = str(context.get("assistant_session_uid") or "").strip() or False

        self.env["openclaw.audit"].sudo().log_event(
            "assistant_command",
            session=session if self._is_openclaw_session(session) else None,
            request_data={
                "command": command,
                "context": context,
                "source": source,
                "assistant_session_uid": assistant_session_uid,
            },
        )
        payload = session._dispatch_tool(tool_name, args)
        self.env["openclaw.audit"].sudo().log_event(
            "odoo_action",
            session=session if self._is_openclaw_session(session) else None,
            request_data={
                "command": command,
                "context": context,
                "source": source,
                "request_id": request_id,
                "assistant_session_uid": assistant_session_uid,
            },
            response_data=payload,
            model=payload.get("records", [{}])[0].get("model") if payload.get("records") else None,
            method=tool_name,
            res_ids=[ref.get("id") for ref in (payload.get("records") or []) if isinstance(ref, dict) and ref.get("id")],
        )
        result = dict(payload or {})
        result.setdefault("command", command)
        result.setdefault("request_id", request_id)
        return result

    def _help(self):
        return {
            "text": (
                "Commands:\n"
                "- help | whoami | session\n"
            "- report.generate\n"
            "- record.create <model> key=value ...\n"
            "- record.update <model> <id> key=value ...\n"
            "- record.search <model> <limit>\n"
            "- record.call <model> <id> <method>\n"
            "- record.post <model> <id>\n"
            "- record.confirm <model> <id>\n"
            "- os.status | os.logs <key> [lines] | os.restart_odoo <service> | os.git_pull <repo_key>"
        )
    }

    def _session_info(self, session):
        txt = (
            f"channel={session.channel}\n"
            f"chat_user_id={session.chat_user_id}\n"
            f"db={session.odoo_db or '-'}\n"
            f"user={session.odoo_login or '-'}\n"
            f"state={session.state}\n"
            f"expires_at={session.expires_at}"
        )
        return {"text": txt}

    def _report_generate(self, session):
        self._require_bound(session)
        result = self.env["openclaw.report.service"].sudo().generate_partner_pdf(session)
        self.env["openclaw.audit"].sudo().log_event(
            "report_render", session=session, response_data=result, model="res.partner", method="report_generate"
        )
        return {
            "text": "Report generated.",
            "buttons": [{"title": "Open report", "url": result["go_url"]}, {"title": "Download", "url": result["go_url"]}],
        }

    def _parse_kv(self, pairs):
        vals = {}
        for p in pairs:
            if "=" not in p:
                continue
            k, v = p.split("=", 1)
            vals[k.strip()] = v.strip()
        return vals

    def _record_create(self, session, args):
        self._require_bound(session)
        if len(args) < 2:
            return {"text": "Usage: record.create <model> key=value ..."}
        model = self._ensure_model_allowed(args[0], "create")
        vals = self._parse_kv(args[1:])
        rec = self.env[model].with_user(session.odoo_uid).with_context(self._ctx_for_session(session)).create(vals)
        self.env["openclaw.audit"].sudo().log_event(
            "odoo_action", session=session, model=model, method="create", res_ids=[rec.id], request_data={"vals": vals}
        )
        return {"text": f"Created {model}({rec.id})."}

    def _record_update(self, session, args):
        self._require_bound(session)
        if len(args) < 3:
            return {"text": "Usage: record.update <model> <id> key=value ..."}
        model = self._ensure_model_allowed(args[0], "write")
        rec_id = int(args[1])
        vals = self._parse_kv(args[2:])
        rec = self.env[model].with_user(session.odoo_uid).with_context(self._ctx_for_session(session)).browse(rec_id)
        rec.write(vals)
        self.env["openclaw.audit"].sudo().log_event(
            "odoo_action", session=session, model=model, method="write", res_ids=[rec.id], request_data={"vals": vals}
        )
        return {"text": f"Updated {model}({rec.id})."}

    def _record_search(self, session, args):
        self._require_bound(session)
        if len(args) < 1:
            return {"text": "Usage: record.search <model> <limit>"}
        model = self._ensure_model_allowed(args[0], "search")
        limit = int(args[1]) if len(args) > 1 else 5
        recs = self.env[model].with_user(session.odoo_uid).with_context(self._ctx_for_session(session)).search([], limit=limit)
        self.env["openclaw.audit"].sudo().log_event(
            "odoo_action", session=session, model=model, method="search", res_ids=recs.ids, request_data={"limit": limit}
        )
        return {"text": f"Found {len(recs)} records: {recs.ids}"}

    def _record_call(self, session, args):
        self._require_bound(session)
        if len(args) < 3:
            return {"text": "Usage: record.call <model> <id> <method>"}
        model = self._ensure_model_allowed(args[0], "call")
        rec_id = int(args[1])
        method = ensure_safe_state_method(args[2])
        rec = self.env[model].with_user(session.odoo_uid).with_context(self._ctx_for_session(session)).browse(rec_id)
        fn = getattr(rec, method, None)
        if not callable(fn):
            raise AccessError(_("Requested method is not available on this model."))
        fn()
        self.env["openclaw.audit"].sudo().log_event(
            "odoo_action", session=session, model=model, method=method, res_ids=[rec.id], request_data={"method": method}
        )
        return {"text": f"Executed {method} on {model}({rec.id})."}

    def _record_post(self, session, args):
        if len(args) < 2:
            return {"text": "Usage: record.post <model> <id>"}
        return self._record_call(session, [args[0], args[1], "action_post"])

    def _record_confirm(self, session, args):
        if len(args) < 2:
            return {"text": "Usage: record.confirm <model> <id>"}
        return self._record_call(session, [args[0], args[1], "action_confirm"])

    def _route_os(self, session, cmd, args):
        admin = self._resolve_admin(session)
        admin.ensure_active()
        res = self.env["openclaw.adminctl.service"].sudo().execute(cmd, args)
        admin.sudo().write({"audit_count": admin.audit_count + 1})
        self.env["openclaw.audit"].sudo().log_event(
            "os_action",
            session=session,
            admin_session=admin,
            request_data={"cmd": cmd, "args": args},
            response_data=res,
            os_command_key=cmd,
        )
        if not res["ok"]:
            return {"text": f"OS command failed:\n{res['stderr']}"}
        return {"text": f"OS command ok:\n{res['stdout'][:1500]}"}

    def start_admin_session(self, session, minutes=10):
        admin = self._resolve_admin(session)
        admin.sudo().write(
            {
                "verified": True,
                "verified_at": fields.Datetime.now(),
                "expires_at": fields.Datetime.now() + timedelta(minutes=minutes),
                "sudo_mode_enabled": True,
            }
        )
        _logger.info("OpenClaw admin verified chat=%s channel=%s", session.chat_user_id, session.channel)
        return admin
