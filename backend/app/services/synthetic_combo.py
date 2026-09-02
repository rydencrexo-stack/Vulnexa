"""On-the-fly synthetic combolist generator for the demo ComboSearch.

Every row is randomly generated and does NOT correspond to any real person,
account, or domain owner. Values are built so the search query is embedded in
the field the user chose to match (domain, login, password, mail, or keyword),
which guarantees the demo returns results for whatever is typed.

This is the ONLY data source for the combo search page — nothing here is or
ever touches real leaked credentials.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass

FIRST = [
    "aarti", "abhay", "aditi", "ajay", "amit", "anand", "anil", "anjali", "ankit", "anup",
    "arjun", "ashish", "bharat", "deepak", "dev", "dinesh", "divya", "gaurav", "gopal", "harsh",
    "himanshu", "imran", "jagdish", "jatin", "kailash", "kamal", "kiran", "kumar", "lalit", "mahesh",
    "manish", "mayur", "mohan", "mukesh", "nakul", "narayan", "nikhil", "nilesh", "pankaj", "parag",
    "paresh", "pramod", "pranav", "pratik", "rahul", "rajesh", "rajiv", "ramesh", "rohan", "rohit",
    "sachin", "sanjay", "santosh", "saurabh", "shailesh", "shankar", "shiv", "shyam", "siddharth", "suresh",
    "tanmay", "tejas", "umesh", "vijay", "vikas", "vinay", "vivek", "yogesh",
]

LAST = [
    "sharma", "verma", "gupta", "singh", "kumar", "yadav", "jain", "mishra", "agrawal", "malhotra",
    "mehta", "shah", "patel", "desai", "joshi", "pandey", "tripathi", "chauhan", "rathore", "saxena",
    "trivedi", "bhatt", "prajapati", "solanki", "chaudhary", "rajput", "bansal", "goyal", "tandon", "sethi",
]

MAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com",
    "protonmail.com", "zoho.com", "icloud.com", "mail.com", "yandex.com",
]

WORDLIST = [
    "college", "campus", "student", "teacher", "principal", "faculty", "exam", "result", "marks",
    "admission", "attendance", "library", "hostel", "laboratory", "computer", "project", "assignment",
    "semester", "rollno", "enroll", "school", "education", "learning", "sports", "cricket", "digital",
    "online", "portal", "erp", "mastersoft", "swami", "indore", "bhopal", "hyderabad", "delhi",
    "password", "admin", "user", "login", "welcome", "secret", "123456", "qwerty", "master",
]

YEARS = [f"{y}" for y in range(2001, 2025)]

DEFAULT_COUNT = 300


@dataclass(slots=True)
class SyntheticResult:
    matches: list[str]
    total: int


def _normalize_domain(query: str) -> str:
    value = query.strip().lower()
    value = re.sub(r"^[a-z]+://", "", value)
    value = value.split("/")[0]
    value = value.lstrip("*.")
    value = value.strip()
    return value or "example.com"


def _random_login(rng: random.Random, domain: str | None = None) -> str:
    handle = rng.choice(FIRST) + "." + rng.choice(LAST) + str(rng.randint(1, 9999))
    if domain:
        return f"{handle}@{domain}"
    return f"{handle}@{rng.choice(MAIL_DOMAINS)}"


def _random_password(rng: random.Random) -> str:
    kind = rng.randint(0, 4)
    if kind == 0:
        return rng.choice(WORDLIST) + rng.choice(["", str(rng.randint(0, 999)), rng.choice(YEARS)])
    if kind == 1:
        return rng.choice(FIRST) + rng.choice(["@", "#", "!", "."]) + rng.choice(YEARS)
    if kind == 2:
        return (
            "".join(rng.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(rng.randint(6, 10)))
            + rng.choice(["1", "123", "2024", "!"])
        )
    if kind == 3:
        return rng.choice(WORDLIST) + rng.choice(WORDLIST) + str(rng.randint(10, 999))
    return rng.choice(["Password@1", "Welcome@123", "Admin@1234", "User@2024"])


def _contains(haystack: str, needle: str) -> bool:
    return bool(needle) and needle.lower() in haystack.lower()


def _build_record(rng: random.Random, query: str, search_type: str) -> tuple[str, str, str] | None:
    q = query.strip()
    if not q:
        return None

    if search_type == "domain":
        domain = _normalize_domain(q)
        url = domain
        login = _random_login(rng, rng.choice(MAIL_DOMAINS))
        return url, login, _random_password(rng)

    if search_type == "login":
        url = f"{_normalize_domain(rng.choice(MAIL_DOMAINS))}"
        login = _random_login(rng).replace("@", q + str(rng.randint(1, 999)) + "@")
        return url, login, _random_password(rng)

    if search_type == "password":
        url = _normalize_domain(rng.choice(MAIL_DOMAINS))
        login = _random_login(rng)
        password = q + rng.choice(["", str(rng.randint(10, 999)), "!"])
        return url, login, password

    if search_type == "mail":
        q_clean = re.sub(r"@.*$", "", q)
        login = f"{_random_login(rng).split('@')[0]}@{q_clean}" if "@" in q else f"{q_clean}.{rng.choice(FIRST)}@{rng.choice(MAIL_DOMAINS)}"
        return _normalize_domain(rng.choice(MAIL_DOMAINS)), login, _random_password(rng)

    if search_type == "keyword":
        mode = rng.randint(0, 2)
        url = _normalize_domain(rng.choice(MAIL_DOMAINS))
        login = _random_login(rng)
        password = _random_password(rng)
        if mode == 0:
            url = f"{q}.{_normalize_domain(rng.choice(MAIL_DOMAINS))}" if "." not in q else f"{q}"
        elif mode == 1:
            login = f"{q}.{_random_login(rng).split('@')[0]}@{rng.choice(MAIL_DOMAINS)}"
        else:
            password = f"{q}{rng.randint(10, 999)}"
        return url, login, password

    return None


def generate_matching(query: str, search_type: str, count: int = DEFAULT_COUNT, seed: int | None = None) -> list[str]:
    """Return up to `count` unique fake url:login:pass lines matching `query`."""
    rng = random.Random(seed)
    lines: set[str] = set()
    attempts = 0
    max_attempts = count * 80 + 2000
    while len(lines) < count and attempts < max_attempts:
        attempts += 1
        built = _build_record(rng, query, search_type)
        if built is None:
            continue
        url, login, password = built
        if not login and not password:
            continue
        # make sure the query actually appears in a plausible field
        if search_type == "domain" and not _contains(url, query):
            continue
        if search_type == "login" and not _contains(login, query):
            continue
        if search_type == "password" and not _contains(password, query):
            continue
        if search_type == "mail" and not (_contains(login, query) or _contains(url, query)):
            continue
        if search_type == "keyword" and not (
            _contains(url, query) or _contains(login, query) or _contains(password, query)
        ):
            continue
        line = f"{url or ''}:{login}:{password}"
        lines.add(line)
    return sorted(lines)


def search(query: str, search_type: str, count: int = DEFAULT_COUNT, seed: int | None = None) -> SyntheticResult:
    matches = generate_matching(query, search_type, count=count, seed=seed)
    return SyntheticResult(matches=matches, total=len(matches))