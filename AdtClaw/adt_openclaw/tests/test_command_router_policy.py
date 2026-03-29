from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase


class TestOpenClawCommandRouterPolicy(TransactionCase):
    def setUp(self):
        super().setUp()
        self.user = self.env.ref("base.user_admin")
        self.session = self.env["openclaw.session"].sudo().create(
            {
                "channel": "web",
                "chat_user_id": "policy-test",
                "odoo_db": self.env.cr.dbname,
                "odoo_uid": self.user.id,
                "odoo_login": self.user.login,
                "state": "bound",
                "company_id": self.user.company_id.id,
                "allowed_company_ids": [(6, 0, self.user.company_ids.ids)],
            }
        )
        self.router = self.env["openclaw.command.router"].sudo()
        self.env["ir.config_parameter"].sudo().set_param("adt_openclaw.allowed_models", "")

    def test_business_model_create_allowed(self):
        result = self.router.route_message(self.session, "record.create res.partner name=PolicyPartner")
        self.assertIn("Created res.partner", result["text"])

    def test_system_model_create_blocked(self):
        with self.assertRaises(AccessError):
            self.router.route_message(self.session, "record.create ir.config_parameter key=foo value=bar")

    def test_ai_agent_disable_blocks_execution(self):
        self.env["ir.config_parameter"].sudo().set_param("adt_openclaw.ai_agent_enabled", "0")
        result = self.router.route_message(self.session, "record.create res.partner name=DisabledPartner")
        self.assertIn("AI agent is disabled", result["text"])
