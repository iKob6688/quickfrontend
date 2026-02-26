import re

SECRET_KEYS = {"password", "passwd", "token", "access_token", "authorization", "secret", "otp_or_password"}


def _redact_value(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9\-\._~\+\/]+=*", r"\1[REDACTED]", value)
        if len(value) > 6:
            return f"{value[:2]}***{value[-2:]}"
        return "***"
    if isinstance(value, (list, tuple)):
        return [_redact_value(v) for v in value]
    if isinstance(value, dict):
        return redact_payload(value)
    return value


def redact_payload(payload):
    if not isinstance(payload, dict):
        return _redact_value(payload)
    redacted = {}
    for key, value in payload.items():
        if key.lower() in SECRET_KEYS:
            redacted[key] = "[REDACTED]"
        else:
            redacted[key] = _redact_value(value)
    return redacted

