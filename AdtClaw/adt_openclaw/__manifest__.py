{
    "name": "ADT OpenClaw",
    "version": "18.0.1.0.0",
    "summary": "Messenger bridge for LINE/Web chat with secure admin controls",
    "category": "Tools",
    "author": "ADT",
    "license": "LGPL-3",
    "depends": ["base", "web"],
    "data": [
        "security/openclaw_security.xml",
        "security/ir.model.access.csv",
        "data/report_templates.xml",
        "data/cleanup_cron.xml",
        "views/openclaw_views.xml",
        "views/res_config_settings_views.xml",
        "views/openclaw_menus.xml",
    ],
    "application": True,
    "installable": True,
}

