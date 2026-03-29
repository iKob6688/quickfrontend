import hashlib

from odoo import fields, models

from ..services.policy import ensure_ai_agent_user, is_ai_agent_enabled


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    openclaw_ai_agent_login = fields.Char(string="AI Agent Login")
    openclaw_ai_agent_name = fields.Char(string="AI Agent Display Name")
    openclaw_ai_agent_password = fields.Char(string="AI Agent Password")
    openclaw_ai_agent_enabled = fields.Boolean(string="Enable AI Agent", default=True)
    openclaw_ai_agent_company_scope = fields.Selection(
        [("all", "All allowed companies"), ("current", "Current company only")],
        string="AI Agent Company Scope",
        default="all",
    )
    openclaw_line_channel_secret = fields.Char(string="LINE Channel Secret")
    openclaw_line_access_token = fields.Char(string="LINE Channel Access Token")
    openclaw_instance_base_url = fields.Char(string="OpenClaw Base URL")
    openclaw_instance_shared_secret = fields.Char(string="OpenClaw Shared Secret")
    openclaw_admin_logins = fields.Char(string="Admin Login Allowlist (CSV)")
    openclaw_repo_allowlist = fields.Char(string="Git Repo Allowlist (CSV key=path)")
    openclaw_log_allowlist = fields.Char(string="Log Path Allowlist (CSV key=path)")
    openclaw_service_allowlist = fields.Char(string="Service Allowlist (CSV)")
    openclaw_adminctl_path = fields.Char(string="Adminctl Path")
    openclaw_admin_verify_code = fields.Char(string="Admin Verify Code")
    openclaw_public_base_url = fields.Char(string="Public Base URL")
    openclaw_allowed_models = fields.Char(string="Allowed Models for record.*")

    def get_values(self):
        res = super().get_values()
        icp = self.env["ir.config_parameter"].sudo()
        res.update(
            openclaw_ai_agent_login=icp.get_param("adt_openclaw.ai_agent_login"),
            openclaw_ai_agent_name=icp.get_param("adt_openclaw.ai_agent_name"),
            openclaw_ai_agent_enabled=is_ai_agent_enabled(self.env),
            openclaw_ai_agent_company_scope=icp.get_param("adt_openclaw.ai_agent_company_scope", "all"),
            openclaw_ai_agent_password="",
            openclaw_line_channel_secret=icp.get_param("adt_openclaw.line_channel_secret"),
            openclaw_line_access_token=icp.get_param("adt_openclaw.line_access_token"),
            openclaw_instance_base_url=icp.get_param("adt_openclaw.instance_base_url"),
            openclaw_instance_shared_secret="********" if icp.get_param("adt_openclaw.instance_shared_secret_hash") else "",
            openclaw_admin_logins=icp.get_param("adt_openclaw.admin_logins"),
            openclaw_repo_allowlist=icp.get_param("adt_openclaw.repo_allowlist"),
            openclaw_log_allowlist=icp.get_param("adt_openclaw.log_allowlist"),
            openclaw_service_allowlist=icp.get_param("adt_openclaw.service_allowlist"),
            openclaw_adminctl_path=icp.get_param("adt_openclaw.adminctl_path", "/usr/local/bin/adt_openclaw_adminctl"),
            openclaw_public_base_url=icp.get_param("adt_openclaw.public_base_url"),
            openclaw_allowed_models=icp.get_param("adt_openclaw.allowed_models", ""),
            openclaw_admin_verify_code="********" if icp.get_param("adt_openclaw.admin_verify_code_hash") else "",
        )
        return res

    def set_values(self):
        super().set_values()
        icp = self.env["ir.config_parameter"].sudo()
        icp.set_param("adt_openclaw.ai_agent_login", self.openclaw_ai_agent_login or "")
        icp.set_param("adt_openclaw.ai_agent_name", self.openclaw_ai_agent_name or "")
        icp.set_param("adt_openclaw.ai_agent_enabled", "1" if self.openclaw_ai_agent_enabled else "0")
        icp.set_param("adt_openclaw.ai_agent_company_scope", self.openclaw_ai_agent_company_scope or "all")
        icp.set_param("adt_openclaw.line_channel_secret", self.openclaw_line_channel_secret or "")
        icp.set_param("adt_openclaw.line_access_token", self.openclaw_line_access_token or "")
        icp.set_param("adt_openclaw.instance_base_url", self.openclaw_instance_base_url or "")
        if self.openclaw_instance_shared_secret and self.openclaw_instance_shared_secret != "********":
            secret_hash = hashlib.sha256(self.openclaw_instance_shared_secret.encode("utf-8")).hexdigest()
            icp.set_param("adt_openclaw.instance_shared_secret_hash", secret_hash)
        icp.set_param("adt_openclaw.admin_logins", self.openclaw_admin_logins or "")
        icp.set_param("adt_openclaw.repo_allowlist", self.openclaw_repo_allowlist or "")
        icp.set_param("adt_openclaw.log_allowlist", self.openclaw_log_allowlist or "")
        icp.set_param("adt_openclaw.service_allowlist", self.openclaw_service_allowlist or "")
        icp.set_param("adt_openclaw.adminctl_path", self.openclaw_adminctl_path or "/usr/local/bin/adt_openclaw_adminctl")
        icp.set_param("adt_openclaw.public_base_url", self.openclaw_public_base_url or "")
        icp.set_param("adt_openclaw.allowed_models", self.openclaw_allowed_models or "")
        if self.openclaw_admin_verify_code and self.openclaw_admin_verify_code != "********":
            code_hash = hashlib.sha256(self.openclaw_admin_verify_code.encode("utf-8")).hexdigest()
            icp.set_param("adt_openclaw.admin_verify_code_hash", code_hash)

        if self.openclaw_ai_agent_login:
            ensure_ai_agent_user(
                self.env,
                self.openclaw_ai_agent_login,
                password=self.openclaw_ai_agent_password or None,
                display_name=self.openclaw_ai_agent_name or self.openclaw_ai_agent_login,
                company_scope=self.openclaw_ai_agent_company_scope or "all",
            )
