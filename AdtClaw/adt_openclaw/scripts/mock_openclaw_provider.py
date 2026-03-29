#!/usr/bin/env python3
"""Small OpenAI-compatible local provider for development smoke tests.

This is not the production LLM. It is a local harness that proves the
assistant stack can talk to an OpenClaw-compatible endpoint on macOS or Linux.
"""

from __future__ import annotations

import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


HOST = os.environ.get("OPENCLAW_BIND_HOST", "127.0.0.1")
PORT = int(os.environ.get("OPENCLAW_BIND_PORT", "11434"))
MODEL = os.environ.get("OPENCLAW_MODEL", "openclaw-local")
DISPLAY_NAME = os.environ.get("OPENCLAW_DISPLAY_NAME", "OpenClaw Local Test Provider")


class Handler(BaseHTTPRequestHandler):
    server_version = "OpenClawMock/1.0"

    def _tool_names(self, payload: dict) -> list[str]:
        names: list[str] = []
        for tool in payload.get("tools") or []:
            fn = (tool or {}).get("function") or {}
            name = str(fn.get("name") or "").strip()
            if name:
                names.append(name)
        return names

    def _last_user_text(self, messages: list[dict]) -> str:
        for message in reversed(messages or []):
            if (message or {}).get("role") == "user":
                content = (message or {}).get("content") or ""
                if isinstance(content, str):
                    text = content.strip()
                    if text.startswith("{") and text.endswith("}"):
                        try:
                            parsed = json.loads(text)
                            if isinstance(parsed, dict) and parsed.get("message"):
                                return str(parsed.get("message") or "")
                        except Exception:
                            pass
                    return text
                if isinstance(content, dict) and content.get("message"):
                    return str(content.get("message") or "")
                return str(content)
        return ""

    def _last_user_payload(self, messages: list[dict]) -> dict:
        for message in reversed(messages or []):
            if (message or {}).get("role") != "user":
                continue
            content = (message or {}).get("content") or {}
            if isinstance(content, dict):
                return content if isinstance(content, dict) else {}
            if isinstance(content, str):
                text = content.strip()
                if text.startswith("{") and text.endswith("}"):
                    try:
                        parsed = json.loads(text)
                        if isinstance(parsed, dict):
                            return parsed
                    except Exception:
                        return {}
        return {}

    def _sanitize_entity_name(self, value: str, fallback: str = "") -> str:
        text = str(value or "").strip()
        if not text:
            return fallback
        text = re.sub(r"^(และ|and)\s+", "", text, flags=re.I).strip()
        cut_words = [
            "ใบเสนอราคา",
            "quotation",
            "quote",
            "sale order",
            "ใบแจ้งหนี้",
            "invoice",
            "สินค้า",
            "product",
            "customer",
            "ลูกค้า",
            "จำนวน",
            "qty",
            "ชิ้น",
            "รายการ",
        ]
        lowered = text.lower()
        for word in cut_words:
            idx = lowered.find(word.lower())
            if idx > 0:
                text = text[:idx].strip()
                lowered = text.lower()
        return text or fallback

    def _extract_customer_query(self, user_text: str) -> str:
        text = (user_text or "").strip()
        patterns = [
            r"(?:ลูกค้า(?:ที่)?(?:บริษัท)?ชื่อ|customer(?: name)?|company)\s*[:=]?\s+(.+?)(?:\s+(?:สินค้า|product|qty|จำนวน|และ|and)\b|$)",
            r"(?:ทำใบเสนอราคาให้บริษัท|ทำใบเสนอราคาให้ลูกค้า|ออกใบเสนอราคาให้บริษัท|ออกใบเสนอราคาให้ลูกค้า|ให้บริษัท|ให้ลูกค้า)\s+(.+?)(?:\s+(?:สินค้า|product|qty|จำนวน|และ|and)\b|$)",
            r"(?:หา|ค้นหา)ลูกค้า\s+(.+?)(?:\s+(?:สินค้า|product|qty|จำนวน|และ|and)\b|$)",
            r"(?:ลูกค้า)\s+(.+?)(?:\s+(?:สินค้า|product|qty|จำนวน|และ|and)\b|$)",
        ]
        for pattern in patterns:
            if m := re.search(pattern, text, re.I):
                return self._sanitize_entity_name(m.group(1), "")
        return ""

    def _extract_product_query(self, user_text: str) -> str:
        text = (user_text or "").strip()
        patterns = [
            r"(?:สินค้า|product|item)\s*[:=]?\s+(.+?)(?:\s+(?:ลูกค้า|customer|company|qty|จำนวน|และ|and)\b|$)",
            r"(?:หา|ค้นหา)สินค้า\s+(.+?)(?:\s+(?:ลูกค้า|customer|company|qty|จำนวน|และ|and)\b|$)",
        ]
        for pattern in patterns:
            if m := re.search(pattern, text, re.I):
                return self._sanitize_entity_name(m.group(1), "")
        return ""

    def _extract_quotation_args(self, user_text: str) -> dict:
        args = {"customer_name": "", "product_name": "", "qty": 1}
        text = (user_text or "").strip()
        if not text:
            return args
        if m := re.search(r"จำนวน\s*([0-9]+(?:\.[0-9]+)?)", text):
            try:
                args["qty"] = max(float(m.group(1)), 1.0)
            except Exception:
                pass
        customer = self._extract_customer_query(text)
        if not customer:
            customer = self._sanitize_entity_name(
                re.sub(
                    r"^(?:สร้างใบเสนอราคา|ออกใบเสนอราคา|ทำใบเสนอราคา|ขอใบเสนอราคา|เสนอราคา|ใบเสนอราคา)\s+",
                    "",
                    text,
                    flags=re.I,
                ),
                "",
            )
        product = self._extract_product_query(text)
        if customer:
            args["customer_name"] = customer
        if product:
            args["product_name"] = product
        return args

    def _entity_from_selection(self, payload: dict, model_name: str) -> dict:
        context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
        ui = context.get("ui") if isinstance(context.get("ui"), dict) else {}
        selection = ui.get("selection") or ui.get("selected_records") or []
        if not isinstance(selection, list):
            selection = []
        for item in selection:
            if not isinstance(item, dict):
                continue
            if str(item.get("model") or "").strip().lower() == model_name:
                return {
                    "id": int(item.get("id") or 0),
                    "name": self._sanitize_entity_name(item.get("name") or "", ""),
                }
        return {}

    def _resolve_entity_json(self, payload: dict, user_text: str) -> dict:
        context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
        ui = context.get("ui") if isinstance(context.get("ui"), dict) else {}
        page_kind = str(ui.get("page_kind") or "").strip().lower()
        selection_customer = self._entity_from_selection(payload, "res.partner")
        selection_product = self._entity_from_selection(payload, "product.product")
        customer_query = self._extract_customer_query(user_text)
        product_query = self._extract_product_query(user_text)
        if selection_customer:
            customer_query = selection_customer["name"]
        if selection_product:
            product_query = selection_product["name"]
        if not customer_query and page_kind == "customers":
            customer_query = self._sanitize_entity_name((ui.get("search") or "").strip(), "")
        if not product_query and page_kind == "products":
            product_query = self._sanitize_entity_name((ui.get("search") or "").strip(), "")
        return {
            "customer_name": customer_query,
            "product_name": product_query,
            "customer_confidence": 0.91 if customer_query else 0.0,
            "product_confidence": 0.91 if product_query else 0.0,
            "reason": "selection" if selection_customer or selection_product else "context",
        }

    def _is_entity_resolution_prompt(self, messages: list[dict]) -> bool:
        text = " ".join(str((msg or {}).get("content") or "") for msg in messages if (msg or {}).get("role") == "system")
        low = text.lower()
        return "entity disambiguation assistant" in low or "return strict json only" in low or "customer_confidence" in low

    def _is_search_resolution_prompt(self, messages: list[dict]) -> bool:
        text = " ".join(str((msg or {}).get("content") or "") for msg in messages if (msg or {}).get("role") == "system")
        low = text.lower()
        return "search query disambiguation assistant" in low or "shortest useful search query" in low

    def _pick_tool_call(self, user_text: str, tool_names: list[str]) -> list[dict]:
        low = user_text.lower().strip()
        names = set(tool_names)

        def has(*needles: str) -> bool:
            return any(n in low for n in needles)

        def tool(name: str, args: dict) -> dict | None:
            if name not in names:
                return None
            return {
                "id": f"call_{name}",
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": json.dumps(args, ensure_ascii=False),
                },
            }

        business_intent = has(
            "customer",
            "ลูกค้า",
            "contact",
            "ผู้ติดต่อ",
            "product",
            "สินค้า",
            "item",
            "quotation",
            "quote",
            "ใบเสนอราคา",
            "เสนอราคา",
            "invoice",
            "bill",
            "ใบแจ้งหนี้",
            "payment",
            "ชำระ",
            "report",
            "รายงาน",
            "summary",
            "สรุป",
            "ยอดขาย",
            "sales",
            "purchase",
            "ซื้อ",
            "create",
            "สร้าง",
            "search",
            "ค้น",
            "find",
            "open",
            "edit",
            "update",
            "post",
            "confirm",
            "write",
        )

        small_talk = (
            low.startswith("hi")
            or low.startswith("hello")
            or low.startswith("hey")
            or low.startswith("สวัสดี")
            or low.startswith("หวัดดี")
            or low.startswith("ขอบคุณ")
            or low.startswith("thanks")
            or low.startswith("test")
            or low.startswith("ping")
            or low in {"", "ok", "okay"}
        ) and not business_intent
        if small_talk:
            return []

        # Basic intent routing so the local provider feels like a real planner.
        if has("customer", "ลูกค้า", "contact", "ผู้ติดต่อ"):
            if has("sales", "ยอดขาย", "highest", "สูงสุด", "top", "ranking", "customer sales", "by sales") and (
                "sales_by_customer" in names or "sales_summary_by_period" in names
            ):
                if tool("sales_by_customer", {"limit": 10}):
                    return [tool("sales_by_customer", {"limit": 10})]
                if tool("sales_summary_by_period", {}):
                    return [tool("sales_summary_by_period", {})]
            customer_query = self._extract_customer_query(user_text) or user_text
            if has("create", "สร้าง", "add", "ใหม่") and tool("create_contact", {"name": customer_query}):
                return [tool("create_contact", {"name": customer_query})]
            if tool("search_contacts", {"query": customer_query}):
                return [tool("search_contacts", {"query": customer_query})]

        if has("product", "สินค้า", "item") and not has("report", "รายงาน"):
            product_query = self._extract_product_query(user_text) or user_text
            if has("create", "สร้าง", "add", "ใหม่") and tool("create_product", {"name": product_query}):
                return [tool("create_product", {"name": product_query})]
            if tool("search_products", {"query": product_query}):
                return [tool("search_products", {"query": product_query})]

        if has("quotation", "quote", "ใบเสนอราคา", "เสนอราคา"):
            args = self._extract_quotation_args(user_text)
            if tool("create_quotation", args):
                return [tool("create_quotation", args)]

        if has("invoice", "bill", "ใบแจ้งหนี้", "ชำระ", "payment"):
            if tool("open_invoice", {"customer_name": "", "product_name": "", "qty": 1}):
                return [tool("open_invoice", {"customer_name": "", "product_name": "", "qty": 1})]

        if has("report", "รายงาน", "สรุป", "summary", "ยอดขาย", "sales", "purchase", "ซื้อ", "ขาย"):
            if has("customer", "ลูกค้า") and has("sales", "ยอดขาย", "highest", "สูงสุด", "top", "ranking"):
                if tool("sales_by_customer", {"limit": 10}):
                    return [tool("sales_by_customer", {"limit": 10})]
            if tool("list_reports", {}):
                return [tool("list_reports", {})]
            if tool("get_help", {"topic": user_text}):
                return [tool("get_help", {"topic": user_text})]

        if tool_names:
            # If the user is asking conversationally, let the model answer directly.
            # Otherwise prefer a help-style tool only when it looks business-adjacent.
            if has("how", "what", "why", "show", "help", "อธิบาย", "ช่วย", "แนะนำ"):
                first = "get_help" if "get_help" in names else tool_names[0]
                if tool(first, {"topic": user_text}):
                    return [tool(first, {"topic": user_text})]
        return []

    def _send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt: str, *args) -> None:
        # Keep stdout clean for launchd/systemd logs.
        print(f"[openclaw-mock] {self.address_string()} {fmt % args}")

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")
        if path == "/v1/models":
            return self._send_json(
                200,
                {
                    "object": "list",
                    "data": [
                        {
                            "id": MODEL,
                            "object": "model",
                            "owned_by": "openclaw-mock",
                            "display_name": DISPLAY_NAME,
                        }
                    ],
                },
            )
        if path == "/health":
            return self._send_json(200, {"ok": True, "model": MODEL})
        return self._send_json(404, {"error": "not_found"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {}

        if path == "/v1/chat/completions":
            messages = payload.get("messages") or []
            user_text = self._last_user_text(messages)
            user_payload = self._last_user_payload(messages)
            if self._is_entity_resolution_prompt(messages):
                resolved = self._resolve_entity_json(user_payload, user_text)
                reply = json.dumps(resolved, ensure_ascii=False)
                return self._send_json(
                    200,
                    {
                        "id": "chatcmpl-mock",
                        "object": "chat.completion",
                        "created": 0,
                        "model": payload.get("model") or MODEL,
                        "choices": [
                            {
                                "index": 0,
                                "message": {"role": "assistant", "content": reply},
                                "finish_reason": "stop",
                            }
                        ],
                        "usage": {
                            "prompt_tokens": 1,
                            "completion_tokens": 1,
                            "total_tokens": 2,
                        },
                    },
                )
            if self._is_search_resolution_prompt(messages):
                context = user_payload.get("current_context") if isinstance(user_payload.get("current_context"), dict) else {}
                selection = context.get("selection") or []
                if not isinstance(selection, list):
                    selection = []
                query = ""
                reason = "context"
                if selection:
                    first = selection[0] if isinstance(selection[0], dict) else {}
                    query = self._sanitize_entity_name(first.get("name") or "", "")
                    reason = "selection"
                if not query:
                    query = self._sanitize_entity_name(user_payload.get("current_query") or user_text, "")
                reply = json.dumps(
                    {
                        "query": query,
                        "reason": reason,
                        "confidence": 0.9 if query else 0.0,
                    },
                    ensure_ascii=False,
                )
                return self._send_json(
                    200,
                    {
                        "id": "chatcmpl-mock",
                        "object": "chat.completion",
                        "created": 0,
                        "model": payload.get("model") or MODEL,
                        "choices": [
                            {
                                "index": 0,
                                "message": {"role": "assistant", "content": reply},
                                "finish_reason": "stop",
                            }
                        ],
                        "usage": {
                            "prompt_tokens": 1,
                            "completion_tokens": 1,
                            "total_tokens": 2,
                        },
                    },
                )
            tool_names = self._tool_names(payload)
            tool_calls = self._pick_tool_call(user_text, tool_names)
            if tool_calls:
                reply = f"{DISPLAY_NAME}: planning -> {user_text}".strip()
                return self._send_json(
                    200,
                    {
                        "id": "chatcmpl-mock",
                        "object": "chat.completion",
                        "created": 0,
                        "model": payload.get("model") or MODEL,
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": reply,
                                    "tool_calls": tool_calls,
                                },
                                "finish_reason": "tool_calls",
                            }
                        ],
                        "usage": {
                            "prompt_tokens": 1,
                            "completion_tokens": 1,
                            "total_tokens": 2,
                        },
                    },
                )

            if user_text.strip():
                reply = (
                    f"{DISPLAY_NAME}: ได้เลย เราคุยกันแบบ chatbot ได้ "
                    f"คุณถามเรื่องงานหรือเรื่องทั่วไปได้เลย ตอนนี้ฉันพร้อมช่วยตอบและช่วยสรุปให้"
                )
            else:
                reply = f"{DISPLAY_NAME}: สวัสดีครับ พร้อมช่วยงานแล้ว"
            return self._send_json(
                200,
                {
                    "id": "chatcmpl-mock",
                    "object": "chat.completion",
                    "created": 0,
                    "model": payload.get("model") or MODEL,
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": reply},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {
                        "prompt_tokens": 1,
                        "completion_tokens": 1,
                        "total_tokens": 2,
                    },
                },
            )

        return self._send_json(404, {"error": "not_found"})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[openclaw-mock] listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
