from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

from ..services.policy import ensure_ai_agent_user


class TestOpenClawAiAgentPolicy(TransactionCase):
    def test_sync_ai_agent_user_creates_assistant_account(self):
        login = "iadmin_test_sync"
        user = ensure_ai_agent_user(
            self.env,
            login,
            password="secret-123",
            display_name="iadmin",
            company_scope="all",
        )
        self.assertTrue(user)
        self.assertEqual(user.login, login)
        self.assertEqual(user.name, "iadmin")
        self.assertIn(self.env.company.id, user.company_ids.ids)

    def test_sync_ai_agent_user_requires_password_when_creating(self):
        with self.assertRaises(ValidationError):
            ensure_ai_agent_user(
                self.env,
                "iadmin_test_missing_password",
                password=None,
                display_name="iadmin",
                company_scope="all",
            )
