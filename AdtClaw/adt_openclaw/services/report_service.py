import base64
import logging

from odoo import models

_logger = logging.getLogger(__name__)


class OpenClawReportService(models.AbstractModel):
    _name = "openclaw.report.service"
    _description = "OpenClaw Report Service"

    def _public_base_url(self):
        icp = self.env["ir.config_parameter"].sudo()
        return icp.get_param("adt_openclaw.public_base_url") or icp.get_param("web.base.url")

    def generate_partner_pdf(self, session):
        if not session.odoo_uid:
            raise ValueError("Session is not bound to local Odoo user")
        partner = (
            self.env["res.partner"]
            .with_user(session.odoo_uid)
            .with_context(allowed_company_ids=session.allowed_company_ids.ids or [session.company_id.id])
            .create({"name": f"OpenClaw Report - {session.chat_user_id}"})
        )
        report = self.env.ref("adt_openclaw.action_report_openclaw_partner")
        pdf_content, _ = report._render_qweb_pdf(partner.id)
        attachment = (
            self.env["ir.attachment"]
            .sudo()
            .create(
                {
                    "name": f"openclaw_{partner.id}.pdf",
                    "type": "binary",
                    "datas": base64.b64encode(pdf_content),
                    "res_model": "res.partner",
                    "res_id": partner.id,
                    "mimetype": "application/pdf",
                }
            )
        )
        redirect_url = f"/adt_openclaw/att/{attachment.id}?download=1"
        token, raw = self.env["openclaw.share_token"].sudo().create_token(
            session=session,
            uid=session.odoo_uid.id,
            dbname=session.odoo_db or self.env.cr.dbname,
            company_id=session.company_id.id if session.company_id else False,
            purpose="attachment_download",
            redirect_url=redirect_url,
            ttl_seconds=180,
            max_uses=1,
        )
        _logger.info("OpenClaw report generated partner=%s attachment=%s token=%s", partner.id, attachment.id, token.id)
        return {"attachment_id": attachment.id, "go_url": f"{self._public_base_url()}/adt_openclaw/go/{raw}"}

