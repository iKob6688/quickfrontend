import logging
import shlex
import subprocess

from odoo import _, models
from odoo.exceptions import AccessError, UserError

from .security_utils import redact_payload

_logger = logging.getLogger(__name__)


class AdminCtlService(models.AbstractModel):
    _name = "openclaw.adminctl.service"
    _description = "OpenClaw AdminCtl Service"

    def _parse_key_map(self, raw):
        mapping = {}
        for item in (raw or "").split(","):
            item = item.strip()
            if not item:
                continue
            if "=" in item:
                key, value = item.split("=", 1)
                mapping[key.strip()] = value.strip()
        return mapping

    def _get_allowlists(self):
        icp = self.env["ir.config_parameter"].sudo()
        services = {x.strip() for x in icp.get_param("adt_openclaw.service_allowlist", "").split(",") if x.strip()}
        repos = self._parse_key_map(icp.get_param("adt_openclaw.repo_allowlist"))
        logs = self._parse_key_map(icp.get_param("adt_openclaw.log_allowlist"))
        return services, repos, logs

    def _helper_path(self):
        return self.env["ir.config_parameter"].sudo().get_param(
            "adt_openclaw.adminctl_path", "/usr/local/bin/adt_openclaw_adminctl"
        )

    def build_command(self, os_command_key, args):
        services, repos, logs = self._get_allowlists()
        helper = self._helper_path()
        args = args or []
        if os_command_key == "os.status":
            return [helper, "status"]
        if os_command_key == "os.get_messenger_token":
            return None
        if os_command_key == "os.restart_odoo":
            service = args[0] if args else ""
            if service not in services:
                raise AccessError(_("Service is not allowlisted."))
            return [helper, "restart-odoo", service]
        if os_command_key == "os.git_pull":
            repo_key = args[0] if args else ""
            repo_path = repos.get(repo_key)
            if not repo_path:
                raise AccessError(_("Repo key is not allowlisted."))
            return [helper, "git-pull", repo_path]
        if os_command_key == "os.logs":
            log_key = args[0] if args else ""
            lines = str(args[1] if len(args) > 1 else 100)
            if log_key not in logs:
                raise AccessError(_("Log key is not allowlisted."))
            return [helper, "tail-log", logs[log_key], lines]
        raise UserError(_("Unsupported OS command."))

    def execute(self, os_command_key, args):
        if os_command_key == "os.get_messenger_token":
            token = self.env["openclaw.instance"].sudo()._hash_value(str(self.env.cr.dbname) + str(self.env.uid))[:32]
            return {"ok": True, "stdout": f"token_ref={token}", "stderr": ""}
        cmd = self.build_command(os_command_key, args)
        _logger.info("OpenClaw adminctl command: %s", shlex.join(cmd))
        try:
            res = subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=30)
        except Exception as err:
            _logger.exception("OpenClaw adminctl failed")
            return {"ok": False, "stdout": "", "stderr": str(err)}
        output = redact_payload({"stdout": (res.stdout or "")[-3000:], "stderr": (res.stderr or "")[-2000:]})
        return {"ok": res.returncode == 0, "stdout": output["stdout"], "stderr": output["stderr"]}

