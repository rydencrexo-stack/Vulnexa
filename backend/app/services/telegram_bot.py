from __future__ import annotations

import io
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field

import httpx

from app.services.combo_store import ComboStore

logger = logging.getLogger("pan.telegram_bot")

API_BASE = "https://api.telegram.org/bot{token}/{method}"

WELCOME = (
    "Hello, {name}!\n\n"
    "use /info for showing all commands"
)

INFO = (
    "all available commands:\n\n"
    "/search example.com\n"
    "(free search url:login:pass, limit 500k lines)\n\n"
    "/login mylogin\n"
    "(free search ulp by login)\n\n"
    "/password mypassword\n"
    "(free search ulp by password)\n\n"
    "/mail example@gmail.com\n"
    "(free search mail passwords)\n\n"
    "/psearch example.com\n"
    "premium ulp search (limit 2M rows)\n\n"
    "/ulpkeyword keyword\n"
    "premium keyword search\n\n"
    "Owner @{owner}"
)

UNKNOWN = "Unknown command. Use /info to list all commands."


@dataclass
class Job:
    chat_id: int
    message_id: int | None
    search: str
    premium: bool
    created_at: float = field(default_factory=time.time)


@dataclass
class CommandSpec:
    text: str
    premium: bool


class TelegramComboBot:
    """Long-polling Telegram bot that searches a local ComboStore.

    This replicates a credential-search bot's command/queue UX against a
    dataset that the operator controls. It does not contact any external
    bot or service.
    """

    def __init__(
        self,
        token: str,
        store: ComboStore,
        *,
        owner_handle: str = "",
        premium_users: set[int] | None = None,
        free_sample: int = 500,
        premium_sample: int = 100_000,
        poll_timeout: int = 30,
    ) -> None:
        self.token = token
        self.store = store
        self.owner_handle = owner_handle
        self.premium_users = premium_users or set()
        self.free_sample = free_sample
        self.premium_sample = premium_sample
        self.poll_timeout = poll_timeout
        self.queue: deque[Job] = deque()
        self.lock = threading.Lock()
        self.search_counts: dict[str, int] = {}
        self._stop = threading.Event()
        self._http = httpx.Client(timeout=60.0)

    # ---- telegram api -----------------------------------------------------

    def _api(self, method: str, **kwargs) -> dict:
        url = API_BASE.format(token=self.token, method=method)
        resp = self._http.post(url, json=kwargs.get("json"), data=kwargs.get("data"), files=kwargs.get("files"))
        resp.raise_for_status()
        payload = resp.json()
        if not payload.get("ok"):
            logger.warning("telegram api %s failed: %s", method, payload.get("description"))
        return payload.get("result") or {}

    def _send(self, chat_id: int, text: str, *, parse_mode: str | None = None) -> None:
        kwargs = {"json": {"chat_id": chat_id, "text": text}}
        if parse_mode:
            kwargs["json"]["parse_mode"] = parse_mode
        self._api("sendMessage", **kwargs)

    def _send_reply(self, job: Job, text: str) -> None:
        if job.message_id:
            self._api(
                "sendMessage",
                json={"chat_id": job.chat_id, "text": text, "reply_to_message_id": job.message_id},
            )
        else:
            self._send(job.chat_id, text)

    def _send_document(self, chat_id: int, filename: str, content: bytes, caption: str | None = None) -> None:
        files = {"document": (filename, io.BytesIO(content), "text/plain")}
        data = {"chat_id": str(chat_id)}
        if caption:
            data["caption"] = caption
        self._api("sendDocument", data=data, files=files)

    # ---- command parsing ---------------------------------------------------

    def _command(self, text: str) -> CommandSpec | None:
        first = text.split(maxsplit=1)[0].lower().lstrip("/").split("@")[0]
        mapping = {
            "start": "/start",
            "info": "/info",
            "search": "/search",
            "login": "/login",
            "password": "/password",
            "mail": "/mail",
            "psearch": "/psearch",
            "ulpkeyword": "/ulpkeyword",
        }
        if first not in mapping:
            return None
        command = mapping[first]
        premium = command in {"/psearch", "/ulpkeyword"}
        return CommandSpec(text=command, premium=premium)

    def _argument(self, text: str) -> str:
        parts = text.split(maxsplit=1)
        return parts[1].strip() if len(parts) > 1 else ""

    # ---- handlers ----------------------------------------------------------

    def _handle_message(self, chat_id: int, message_id: int | None, user_first: str, text: str) -> None:
        spec = self._command(text)
        if spec is None:
            self._send(chat_id, UNKNOWN)
            return

        if spec.text == "/start":
            self._send(chat_id, WELCOME.format(name=user_first or "user"))
            return
        if spec.text == "/info":
            self._send(chat_id, INFO.format(owner=self.owner_handle))
            return

        arg = self._argument(text)
        if not arg:
            self._send(chat_id, f"Usage: {spec.text} <query>")
            return

        premium = spec.premium and chat_id in self.premium_users
        if spec.premium and not premium:
            self._send(chat_id, "Premium search requires a premium account.")
            return

        self._enqueue(chat_id, message_id, arg, spec.text, premium)

    def _enqueue(self, chat_id: int, message_id: int | None, arg: str, command: str, premium: bool) -> None:
        with self.lock:
            job = Job(chat_id=chat_id, message_id=message_id, search=arg, premium=premium)
            self.queue.append(job)
            position = len(self.queue)
        self._send(chat_id, f"Your request added to query. Query position: {position}")

    def _count_mention(self, search: str) -> int:
        with self.lock:
            self.search_counts[search] = self.search_counts.get(search, 0) + 1
            return self.search_counts[search]

    # ---- worker ------------------------------------------------------------

    def _process(self, job: Job) -> None:
        self._send_reply(job, f"you choosed format: url:login:pass")
        times = self._count_mention(job.search)
        self._send_reply(job, f"Started search: {job.search}\nwas searched {times} times")

        result = self._dispatch(job.search, job.premium)
        total = len(result.matches)
        shown = min(total, self.premium_sample if job.premium else self.free_sample)
        summary = (
            f"Found {total:,} uniq strings for {job.search}.\n"
            + ("Premium shows 100%" if job.premium else "Free version shows: {:,}".format(shown))
        )
        self._send_reply(job, summary)
        self._send_reply(job, f"{job.search} format url:login:pass")

        sample = result.matches[:shown]
        if not sample:
            self._send(job.chat_id, "No matches found.")
            return
        content = "\n".join(sample).encode("utf-8", errors="ignore")
        self._send_document(job.chat_id, f"{job.search}.txt", content, caption=f"{len(sample):,} lines")

    def _dispatch(self, search: str, premium: bool):
        if premium:
            return self.store.by_keyword(search)
        return self.store.by_domain(search)

    def _worker_loop(self) -> None:
        while not self._stop.is_set():
            with self.lock:
                if self.queue:
                    job = self.queue.popleft()
                else:
                    job = None
            if job is None:
                time.sleep(0.2)
                continue
            try:
                self._process(job)
            except Exception:
                logger.exception("failed to process job")
                self._send(job.chat_id, "Search failed. Please try again.")

    # ---- polling -----------------------------------------------------------

    def _poll_loop(self) -> None:
        offset = 0
        while not self._stop.is_set():
            try:
                result = self._api(
                    "getUpdates",
                    json={"timeout": self.poll_timeout, "offset": offset, "allowed_updates": ["message"]},
                )
            except Exception:
                logger.exception("getUpdates failed")
                time.sleep(2)
                continue

            for update in result:
                offset = max(offset, update.get("update_id", 0) + 1)
                message = update.get("message")
                if not message:
                    continue
                chat_id = int(message["chat"]["id"])
                text = message.get("text")
                if not text:
                    continue
                message_id = message.get("message_id")
                user = message.get("from", {}).get("first_name", "")
                try:
                    self._handle_message(chat_id, message_id, user, text)
                except Exception:
                    logger.exception("failed to handle message from %s", chat_id)

    # ---- lifecycle ---------------------------------------------------------

    def run(self) -> None:
        poller = threading.Thread(target=self._poll_loop, name="telegram-poller", daemon=True)
        worker = threading.Thread(target=self._worker_loop, name="telegram-worker", daemon=True)
        poller.start()
        worker.start()
        logger.info("telegram bot started (long polling)")
        try:
            while not self._stop.is_set():
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()

    def stop(self) -> None:
        self._stop.set()
        self._http.close()
        logger.info("telegram bot stopped")


def main() -> None:
    import os

    from dotenv import load_dotenv

    logging.basicConfig(level=logging.INFO)
    load_dotenv()

    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("TELEGRAM_BOT_TOKEN is not set")

    data_dir = os.getenv("TELEGRAM_COMBOLIST_DIR", "data/combolist")
    owner_handle = os.getenv("TELEGRAM_OWNER_HANDLE", "")
    premium = {int(x) for x in os.getenv("TELEGRAM_PREMIUM_USERS", "").split(",") if x.strip().isdigit()}

    store = ComboStore(data_dir)
    bot = TelegramComboBot(token, store, owner_handle=owner_handle, premium_users=premium)
    bot.run()


if __name__ == "__main__":
    main()