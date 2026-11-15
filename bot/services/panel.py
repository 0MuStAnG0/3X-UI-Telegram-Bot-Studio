from __future__ import annotations

import asyncio
import json
import logging
import random
import string
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
from aiohttp_socks import ProxyConnector, ProxyType
from config import cfg

logger = logging.getLogger(__name__)

GB = 1024 ** 3
DAY_MS = 86_400_000


class PanelError(Exception):
    pass


class PanelClient:
    """
    Async 3X-UI API client authenticating strictly via Bearer API Token
    (no panel username/password required) with optional SOCKS5 proxy support.
    """

    def __init__(self) -> None:
        self._session: Optional[aiohttp.ClientSession] = None
        self._p = cfg.panel_path

    def build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {cfg.panel_api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _build_connector(self) -> aiohttp.BaseConnector:
        if cfg.proxy_enabled:
            return ProxyConnector(
                proxy_type=ProxyType.SOCKS5,
                host=cfg.proxy_host,
                port=int(cfg.proxy_port),
                username=cfg.proxy_user or None,
                password=cfg.proxy_pass or None,
                rdns=True,
                ssl=False,
                limit=10,
                ttl_dns_cache=300,
            )
        return aiohttp.TCPConnector(limit=10, ttl_dns_cache=300, ssl=False)

    async def _sess(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                base_url=cfg.panel_url,
                headers=self.build_headers(),
                connector=self._build_connector(),
                connector_owner=True,
                timeout=aiohttp.ClientTimeout(total=30, connect=10),
            )
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def _req(self, method: str, path: str, **kwargs: Any) -> Dict[str, Any]:
        sess = await self._sess()
        last_err: Optional[Exception] = None
        for attempt in range(3):
            try:
                async with getattr(sess, method)(path, **kwargs) as resp:
                    text = await resp.text()
                    if resp.status >= 400:
                        raise PanelError(f"{method.upper()} {path} -> HTTP {resp.status}: {text[:300]}")
                    try:
                        data = json.loads(text)
                    except json.JSONDecodeError as exc:
                        raise PanelError(f"Invalid JSON response from panel: {text[:200]}") from exc
                    if not data.get("success", False):
                        raise PanelError(data.get("msg") or "Panel API returned success=false")
                    return data
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_err = exc
                if attempt < 2:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise PanelError(f"Panel request failed after retries: {exc}") from exc
        raise PanelError(f"Panel request failed: {last_err}")

    def _default_inbound_ids(self) -> List[int]:
        return [int(i_id) for i_id, _remark, _flow in cfg.inbounds] if cfg.inbounds else [cfg.inbound_id]

    def _default_flow(self) -> str:
        return next((f for _id, _remark, f in cfg.inbounds if f), "") if cfg.inbounds else ""

    async def list_inbounds(self) -> List[Dict[str, Any]]:
        data = await self._req("get", f"{self._p}/panel/api/inbounds/list")
        return data.get("obj") or []

    async def add_client(
        self,
        email: str,
        sub_id: str,
        traffic_bytes: int,
        expire_ms: int,
        inbound_ids: Optional[List[int]] = None,
        flow: Optional[str] = None,
    ) -> None:
        if inbound_ids is None:
            inbound_ids = self._default_inbound_ids()
        if flow is None:
            flow = self._default_flow()
        payload = {
            "client": {
                "email": email,
                "subId": sub_id,
                "flow": flow,
                "totalGB": traffic_bytes,
                "expiryTime": expire_ms,
                "tgId": 0,
                "limitIp": 0,
                "enable": True,
            },
            "inboundIds": [int(i) for i in inbound_ids],
        }
        await self._req("post", f"{self._p}/panel/api/clients/add", json=payload)

    async def update_client(
        self,
        email: str,
        sub_id: str,
        traffic_bytes: int,
        expire_ms: int,
        client_id: Optional[str] = None,
        flow: Optional[str] = None,
    ) -> None:
        if flow is None:
            flow = self._default_flow()
        payload: Dict[str, Any] = {
            "email": email,
            "subId": sub_id,
            "flow": flow,
            "totalGB": traffic_bytes,
            "expiryTime": expire_ms,
            "tgId": 0,
            "limitIp": 0,
            "enable": True,
        }
        if client_id:
            payload["id"] = str(client_id)
        await self._req("post", f"{self._p}/panel/api/clients/update/{email}", json=payload)

    async def delete_client(self, email: str) -> None:
        await self._req("post", f"{self._p}/panel/api/clients/del/{email}")

    async def get_client(self, email: str) -> Optional[Dict[str, Any]]:
        data = await self._req("get", f"{self._p}/panel/api/clients/get/{email}")
        obj = data.get("obj") or {}
        client = obj.get("client") or {}
        if not client:
            return None
        return {
            "id": client.get("id", ""),
            "email": client.get("email", email),
            "subId": client.get("subId", ""),
            "flow": client.get("flow", ""),
            "totalGB": client.get("totalGB", 0),
            "usedTraffic": obj.get("usedTraffic", 0),
            "expiryTime": client.get("expiryTime", 0),
            "enable": client.get("enable", True),
        }

    @staticmethod
    def new_sub_id() -> str:
        return uuid.uuid4().hex

    async def create_client(
        self,
        gb: float,
        days: int,
        email: str = "",
        inbound_ids: Optional[List[int]] = None,
        flow: Optional[str] = None,
    ) -> Tuple[str, str]:
        if not email:
            for _ in range(5):
                candidate = "u" + "".join(random.choices(string.ascii_lowercase + string.digits, k=12))
                try:
                    existing = await self.get_client(candidate)
                    if existing:
                        continue
                except Exception:
                    pass
                email = candidate
                break
        sub_id = self.new_sub_id()
        traffic_bytes = int(gb * GB)
        expire_ms = int(time.time() * 1000) + int(days * DAY_MS)
        await self.add_client(email, sub_id, traffic_bytes, expire_ms, inbound_ids=inbound_ids, flow=flow)
        return email, sub_id

    async def renew_client(self, email: str, add_gb: int) -> None:
        c = await self.get_client(email)
        if not c:
            raise PanelError(f"Client not found: {email}")
        now_ms = int(time.time() * 1000)
        new_expire = now_ms + 30 * DAY_MS
        new_total = int(c["totalGB"]) + int(add_gb) * GB
        await self.update_client(
            email,
            c["subId"],
            new_total,
            new_expire,
            flow=c.get("flow", ""),
        )

    async def change_link(self, email: str) -> str:
        c = await self.get_client(email)
        if not c:
            raise PanelError(f"Client not found: {email}")
        new_sub = self.new_sub_id()
        new_uuid = str(uuid.uuid4())
        await self.update_client(
            email,
            new_sub,
            int(c["totalGB"]),
            int(c["expiryTime"]),
            client_id=new_uuid,
            flow=c.get("flow", ""),
        )
        return new_sub

    def sub_url(self, sub_id: str) -> str:
        return f"{cfg.sub_base_url}/{sub_id}"

    @staticmethod
    def bytes_to_gb(b: int) -> float:
        return round(b / GB, 2)

    @staticmethod
    def remaining_days(expire_ms: int) -> int:
        if not expire_ms:
            return 0
        remaining = expire_ms - int(time.time() * 1000)
        return max(0, remaining // DAY_MS)

    @staticmethod
    def expire_date(expire_ms: int) -> str:
        if not expire_ms:
            return "نامحدود"
        return datetime.fromtimestamp(expire_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


panel = PanelClient()
