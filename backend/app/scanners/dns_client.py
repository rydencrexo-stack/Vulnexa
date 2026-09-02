"""Minimal dependency-free DNS client (stdlib only).

Performs A, AAAA, CNAME, MX, NS, TXT, CAA, PTR queries against public
resolvers over UDP and returns parsed answer records. Used by the passive
Surface Finder so no external binaries or DNS libraries are required.
"""

from __future__ import annotations

import random
import socket
import struct
from typing import Any

TYPE_A = 1
TYPE_NS = 2
TYPE_CNAME = 5
TYPE_PTR = 12
TYPE_MX = 15
TYPE_TXT = 16
TYPE_AAAA = 28
TYPE_CAA = 257

RESOLVERS = ("8.8.8.8", "1.1.1.1", "9.9.9.9")


def _encode_name(name: str) -> bytes:
    name = name.rstrip(".")
    out = b""
    if name:
        for part in name.split("."):
            encoded = part.encode("idna")
            if len(encoded) > 63:
                return b"\x00"
            out += bytes([len(encoded)]) + encoded
    return out + b"\x00"


def _decode_name(data: bytes, offset: int) -> tuple[str, int]:
    labels: list[str] = []
    jumps = 0
    end: int | None = None
    while True:
        if offset >= len(data):
            break
        length = data[offset]
        if length & 0xC0 == 0xC0:
            if offset + 1 >= len(data):
                break
            pointer = struct.unpack("!H", data[offset : offset + 2])[0] & 0x3FFF
            if end is None:
                end = offset + 2
            offset = pointer
            jumps += 1
            if jumps > 20:
                break
            continue
        offset += 1
        if length == 0:
            if end is None:
                end = offset
            break
        if offset + length > len(data):
            break
        try:
            labels.append(data[offset : offset + length].decode("idna"))
        except UnicodeDecodeError:
            labels.append("?")
        offset += length
    return ".".join(labels), end if end is not None else offset


def _parse_answers(data: bytes) -> list[dict[str, Any]]:
    if len(data) < 12:
        return []
    _, _, qdcount, ancount, _, _ = struct.unpack("!HHHHHH", data[:12])
    offset = 12
    for _ in range(qdcount):
        _, offset = _decode_name(data, offset)
        offset += 4
    answers: list[dict[str, Any]] = []
    for _ in range(ancount):
        if offset + 10 > len(data):
            break
        name, offset = _decode_name(data, offset)
        if offset + 10 > len(data):
            break
        rtype, rclass, ttl, rdlength = struct.unpack("!HHIH", data[offset : offset + 10])
        offset += 10
        rdata_start = offset
        rdata: Any = None
        if rtype == TYPE_A:
            if offset + 4 <= len(data):
                rdata = socket.inet_ntop(socket.AF_INET, data[offset : offset + 4])
            offset += 4
        elif rtype == TYPE_AAAA:
            if offset + 16 <= len(data):
                rdata = socket.inet_ntop(socket.AF_INET6, data[offset : offset + 16])
            offset += 16
        elif rtype in (TYPE_CNAME, TYPE_NS, TYPE_PTR):
            rdata, offset = _decode_name(data, offset)
        elif rtype == TYPE_MX:
            if offset + 2 <= len(data):
                preference = struct.unpack("!H", data[offset : offset + 2])[0]
                offset += 2
                exchange, offset = _decode_name(data, offset)
                rdata = {"preference": preference, "exchange": exchange}
        elif rtype == TYPE_TXT:
            strings: list[str] = []
            while offset < rdata_start + rdlength and offset < len(data):
                size = data[offset]
                offset += 1
                chunk = data[offset : offset + size]
                try:
                    strings.append(chunk.decode("utf-8", errors="replace"))
                except Exception:  # noqa: BLE001
                    strings.append("")
                offset += size
            rdata = strings
        elif rtype == TYPE_CAA:
            if offset + 2 <= len(data):
                flags = data[offset]
                tag_length = data[offset + 1]
                offset += 2
                if offset + tag_length <= len(data):
                    tag = data[offset : offset + tag_length].decode("ascii", errors="replace")
                    offset += tag_length
                    value = data[offset : offset + rdlength - 2 - tag_length].decode("utf-8", errors="replace")
                    offset += rdlength - 2 - tag_length
                    rdata = {"flags": flags, "tag": tag, "value": value}
        else:
            offset = rdata_start + rdlength
        offset = max(offset, rdata_start + rdlength)
        answers.append({"name": name, "type": rtype, "ttl": ttl, "value": rdata})
    return answers


def _query(name: str, qtype: int, timeout: float = 3.0) -> list[dict[str, Any]]:
    transaction_id = random.randint(0, 65535)
    header = struct.pack("!HHHHHH", transaction_id, 0x0100, 1, 0, 0, 0)
    question = _encode_name(name) + struct.pack("!HH", qtype, 1)
    packet = header + question
    for server in RESOLVERS:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        try:
            sock.sendto(packet, (server, 53))
            data, _ = sock.recvfrom(4096)
            if len(data) < 12:
                continue
            received_id = struct.unpack("!H", data[:2])[0]
            if received_id != transaction_id:
                continue
            return _parse_answers(data)
        except (socket.timeout, OSError):
            continue
        finally:
            sock.close()
    return []


def _cname_chain(answers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chain: list[dict[str, Any]] = []
    for answer in answers:
        if answer["type"] == TYPE_CNAME:
            chain.append({"type": "cname", "value": answer["value"]})
        elif answer["type"] in (TYPE_A, TYPE_AAAA):
            chain.append({"type": answer["type"], "value": answer["value"]})
    return chain


def resolve(name: str, timeout: float = 3.0) -> dict[str, Any]:
    """Return A/AAAA/CNAME records plus MX/NS/TXT/CAA in one call."""
    result: dict[str, Any] = {
        "a": [],
        "aaaa": [],
        "cname": [],
        "mx": [],
        "ns": [],
        "txt": [],
        "caa": [],
        "ptr": [],
    }
    answers = _query(name, TYPE_A, timeout) + _query(name, TYPE_AAAA, timeout) + _query(name, TYPE_CNAME, timeout)
    for answer in answers:
        if answer["type"] == TYPE_A and isinstance(answer["value"], str):
            result["a"].append(answer["value"])
        elif answer["type"] == TYPE_AAAA and isinstance(answer["value"], str):
            result["aaaa"].append(answer["value"])
        elif answer["type"] == TYPE_CNAME and isinstance(answer["value"], str):
            result["cname"].append(answer["value"])
    for answer in _query(name, TYPE_MX, timeout):
        if isinstance(answer.get("value"), dict):
            result["mx"].append(answer["value"])
    for answer in _query(name, TYPE_NS, timeout):
        if isinstance(answer.get("value"), str):
            result["ns"].append(answer["value"])
    for answer in _query(name, TYPE_TXT, timeout):
        if isinstance(answer.get("value"), list):
            result["txt"].append("".join(answer["value"]))
    for answer in _query(name, TYPE_CAA, timeout):
        if isinstance(answer.get("value"), dict):
            result["caa"].append(answer["value"])
    return result


def reverse_dns(ip: str, timeout: float = 3.0) -> str | None:
    try:
        parts = ip.split(".")
        if len(parts) != 4:
            return None
        reverse = ".".join(reversed(parts)) + ".in-addr.arpa"
        for answer in _query(reverse, TYPE_PTR, timeout):
            if isinstance(answer.get("value"), str):
                return answer["value"]
    except Exception:  # noqa: BLE001
        return None
    return None


if __name__ == "__main__":
    import json
    import sys

    for name in sys.argv[1:] or ["example.com"]:
        print(json.dumps({name: resolve(name)}, indent=2))