from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase


class TestOpenClawAdminPolicy(TransactionCase):
    def setUp(self):
        super().setUp()
        icp = self.env["ir.config_parameter"].sudo()
        icp.set_param("adt_openclaw.service_allowlist", "odoo18")
        icp.set_param("adt_openclaw.repo_allowlist", "main=/srv/odoo/src")
        icp.set_param("adt_openclaw.log_allowlist", "odoo=/var/log/odoo/odoo.log")
        icp.set_param("adt_openclaw.adminctl_path", "/usr/local/bin/adt_openclaw_adminctl")
        self.service = self.env["openclaw.adminctl.service"].sudo()

    def test_allowlist_blocks_unknown(self):
        with self.assertRaises(AccessError):
            self.service.build_command("os.restart_odoo", ["invalid"])
        with self.assertRaises(AccessError):
            self.service.build_command("os.git_pull", ["unknown"])
        with self.assertRaises(AccessError):
            self.service.build_command("os.logs", ["unknown", 10])

    def test_allowlist_accepts_known(self):
        self.assertEqual(
            self.service.build_command("os.restart_odoo", ["odoo18"]),
            ["/usr/local/bin/adt_openclaw_adminctl", "restart-odoo", "odoo18"],
        )
        self.assertEqual(
            self.service.build_command("os.git_pull", ["main"]),
            ["/usr/local/bin/adt_openclaw_adminctl", "git-pull", "/srv/odoo/src"],
        )

    def test_admin_session_expiry(self):
        admin = self.env["openclaw.admin_session"].sudo().create(
            {
                "channel": "web",
                "chat_user_id": "adm01",
                "verified": True,
                "verified_at": fields.Datetime.now(),
                "expires_at": fields.Datetime.now() - timedelta(minutes=1),
            }
        )
        with self.assertRaises(AccessError):
            admin.ensure_active()

