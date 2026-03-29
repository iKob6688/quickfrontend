from odoo import _
from odoo.exceptions import AccessError, ValidationError


SYSTEM_ALWAYS_DENY_MODELS = {
    "res.config.settings",
    "res.groups",
    "ir.config_parameter",
    "ir.module.module",
    "ir.module.category",
    "ir.model",
    "ir.model.fields",
    "ir.model.access",
    "ir.rule",
    "ir.ui.menu",
    "ir.ui.view",
    "ir.actions.act_window",
    "ir.actions.server",
    "ir.cron",
    "ir.translation",
    "ir.sequence",
    "ir.property",
    "ir.filters",
}

SYSTEM_MUTATION_BLOCKED_MODELS = {
    "res.company",
    "res.users",
}

READ_ONLY_SYSTEM_MODELS = {
    "res.company",
    "res.users",
}

SAFE_STATE_METHODS = {
    "action_post",
    "button_post",
    "action_confirm",
    "button_confirm",
    "action_approve",
    "button_approve",
    "action_cancel",
    "button_cancel",
}


def normalize_model_name(model_name):
    return (model_name or "").strip()


def is_ai_agent_enabled(env):
    return env["ir.config_parameter"].sudo().get_param("adt_openclaw.ai_agent_enabled", "1") == "1"


def _is_ir_model(model_name):
    return normalize_model_name(model_name).startswith("ir.")


def ensure_business_model_allowed(model_name, operation="read"):
    model = normalize_model_name(model_name)
    if not model:
        raise AccessError(_("Model name is required."))

    op = (operation or "read").strip().lower()

    if model in SYSTEM_ALWAYS_DENY_MODELS or _is_ir_model(model):
        raise AccessError(_("System configuration models are restricted."))

    if model in SYSTEM_MUTATION_BLOCKED_MODELS and op not in {"read", "search"}:
        raise AccessError(_("System configuration models are restricted."))

    return True


def ensure_safe_state_method(method_name):
    method = (method_name or "").strip()
    if method not in SAFE_STATE_METHODS:
        raise AccessError(_("Method is not allowlisted for assistant execution."))
    return method


def ensure_ai_agent_user(env, login, password=None, display_name=None, company_scope="all"):
    login = (login or "").strip()
    if not login:
        return None

    user_model = env["res.users"].sudo().with_context(no_reset_password=True)
    existing = user_model.search([("login", "=", login)], limit=1)

    companies = env["res.company"].sudo().search([]) if company_scope == "all" else env.company
    company_ids = companies.ids if hasattr(companies, "ids") else [companies.id]
    if not company_ids:
        company_ids = [env.company.id]

    vals = {
        "name": (display_name or login).strip() or login,
        "login": login,
        "company_id": company_ids[0],
        "company_ids": [(6, 0, company_ids)],
    }

    if existing:
        if password:
            try:
                existing._set_password(password)
            except AttributeError:
                existing.write({"password": password})
        existing.write(vals)
        return existing

    if not password:
        raise ValidationError(_("AI agent password is required when creating a new assistant account."))

    create_vals = dict(vals)
    create_vals["password"] = password
    try:
        create_vals["groups_id"] = [(4, env.ref("base.group_user").id)]
    except Exception:
        pass
    return user_model.create(create_vals)
