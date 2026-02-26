from odoo import models


class OpenClawWebAdapter(models.AbstractModel):
    _name = "openclaw.web.adapter"
    _description = "OpenClaw Web Adapter"

    def to_web_payload(self, payload):
        return {"text": payload.get("text", ""), "buttons": payload.get("buttons", []), "cards": payload.get("cards", [])}

