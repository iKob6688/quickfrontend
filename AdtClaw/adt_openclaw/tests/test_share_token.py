from datetime import timedelta

from odoo import fields
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase


class TestOpenClawShareToken(TransactionCase):
    def setUp(self):
        super().setUp()
        self.user = self.env.ref("base.user_admin")
        self.session = self.env["openclaw.session"].sudo().create(
            {
                "channel": "web",
                "chat_user_id": "u-test",
                "odoo_db": self.env.cr.dbname,
                "odoo_uid": self.user.id,
                "odoo_login": self.user.login,
                "state": "bound",
            }
        )

    def test_token_single_use(self):
        token_model = self.env["openclaw.share_token"].sudo()
        token, raw = token_model.create_token(
            session=self.session,
            uid=self.user.id,
            dbname=self.env.cr.dbname,
            company_id=self.user.company_id.id,
            purpose="web_login",
            redirect_url="/web",
            ttl_seconds=60,
            max_uses=1,
        )
        consumed = token_model.consume_raw_token(raw)
        self.assertEqual(consumed.id, token.id)
        self.assertEqual(consumed.state, "used")
        with self.assertRaises(ValidationError):
            token_model.consume_raw_token(raw)

    def test_token_expiry(self):
        token_model = self.env["openclaw.share_token"].sudo()
        token, raw = token_model.create_token(
            session=self.session,
            uid=self.user.id,
            dbname=self.env.cr.dbname,
            company_id=self.user.company_id.id,
            purpose="web_login",
            redirect_url="/web",
            ttl_seconds=60,
            max_uses=1,
        )
        token.write({"expires_at": fields.Datetime.now() - timedelta(minutes=1)})
        with self.assertRaises(ValidationError):
            token_model.consume_raw_token(raw)
        self.assertEqual(token.state, "expired")

