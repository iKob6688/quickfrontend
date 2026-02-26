import json
import logging
import urllib.request

from odoo import models

_logger = logging.getLogger(__name__)


class OpenClawLineAdapter(models.AbstractModel):
    _name = "openclaw.line.adapter"
    _description = "OpenClaw LINE Adapter"

    def reply_message(self, reply_token, payload):
        access_token = self.env["ir.config_parameter"].sudo().get_param("adt_openclaw.line_access_token")
        if not access_token:
            _logger.warning("LINE access token is not configured")
            return False
        text = payload.get("text", "")[:4500]
        body = {"replyToken": reply_token, "messages": [{"type": "text", "text": text}]}
        req = urllib.request.Request(
            "https://api.line.me/v2/bot/message/reply",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10):
                return True
        except Exception as err:
            _logger.exception("LINE reply failed: %s", err)
            return False

