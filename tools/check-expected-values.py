#!/usr/bin/env python3
"""Independent reference oracle for the loan origination rule set 2026.10.

Parses every scenario in features-shared/ that evaluates an explicit applicant
("an applicant with:" + "submits an application for ..."), recomputes the
expected outcome with decimal arithmetic from the platform specification §5,
and fails if any expected value written in the Gherkin disagrees.

It also verifies the fixtures in specification §13.

This is Phase 0 evidence, not SUT code. It shares no code with domain-core.

Usage:  pip install gherkin-official && python3 tools/check-expected-values.py
"""
from __future__ import annotations

import glob
import os
import re
import sys
from datetime import date, datetime
from decimal import ROUND_HALF_EVEN, Decimal as D
from zoneinfo import ZoneInfo

from gherkin.parser import Parser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "features-shared")
LONDON = ZoneInfo("Europe/London")
DSR_PASS_LIMIT = {"A": D("40.00"), "B": D("35.00"), "C": D("30.00")}
REFER_BAND = D("5.00")
RESIDUAL_MIN = D("300.00")
REASON = {"R01_AGE": "ELIGIBILITY_AGE", "R02_CREDIT_BAND": "CREDIT_HISTORY",
          "R03_DSR": "AFFORDABILITY_DSR", "R04_RESIDUAL_INCOME": "AFFORDABILITY_RESIDUAL"}
STATUS_FOR = {"ACCEPT": "AWAITING_APPROVAL", "REFER": "REFERRED", "DECLINE": "DECLINED"}
TWO = D("0.01")


# --- Reference model (specification §5) ---------------------------------------

def band(score: int) -> str:
    return "A" if score >= 881 else "B" if score >= 721 else "C" if score >= 561 else "D"


def is_leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def age_on(dob: date, now_utc: datetime) -> int:
    today = now_utc.astimezone(LONDON).date()
    month, day = dob.month, dob.day
    if (month, day) == (2, 29) and not is_leap(today.year):
        month, day = 3, 1  # specification decision, §5
    return today.year - dob.year - ((today.month, today.day) < (month, day))


def evaluate(app: dict, now_utc: datetime) -> dict:
    inc, com = app["net monthly income"], app["monthly credit commitments"]
    ess, rep = app["essential monthly expenditure"], app["repayment"]
    results = {}
    age = age_on(app["date of birth"], now_utc)
    results["R01_AGE"] = ("PASS" if age >= 18 else "FAIL", str(age), "18")
    b = band(app["credit reference score"])
    results["R02_CREDIT_BAND"] = ("FAIL" if b == "D" else "PASS", b, "C")
    dsr = ((com + rep) / inc * 100).quantize(TWO, ROUND_HALF_EVEN)
    if b == "D":
        results["R03_DSR"] = ("NOT_APPLICABLE", str(dsr), "none")
    else:
        limit = DSR_PASS_LIMIT[b]
        r = "PASS" if dsr <= limit else "REFER" if dsr <= limit + REFER_BAND else "FAIL"
        results["R03_DSR"] = (r, str(dsr), str(limit))
    residual = (inc - com - rep - ess).quantize(TWO)
    results["R04_RESIDUAL_INCOME"] = ("PASS" if residual >= RESIDUAL_MIN else "FAIL",
                                      str(residual), str(RESIDUAL_MIN))
    outcomes = [v[0] for v in results.values()]
    rec = "DECLINE" if "FAIL" in outcomes else "REFER" if "REFER" in outcomes else "ACCEPT"
    reasons = [REASON[k] for k, v in results.items() if v[0] == "FAIL"]
    return {"band": b, "dsr": str(dsr), "recommendation": rec, "reasons": reasons,
            "rules": results, "status": STATUS_FOR[rec]}


# --- Gherkin walking -----------------------------------------------------------

SUBMIT = re.compile(r'^\w+ submits an application for ([\d.]+) over (\d+) months '
                    r'with a monthly repayment of ([\d.]+)( using only the keyboard)?$')


def expand(feature: dict):
    background = []
    for child in feature["children"]:
        if "background" in child:
            background = child["background"]["steps"]
    for child in feature["children"]:
        sc = child.get("scenario")
        if not sc:
            continue
        examples = sc.get("examples") or []
        if not examples:
            yield sc["name"], background + sc["steps"], {}
            continue
        for ex in examples:
            headers = [c["value"] for c in ex["tableHeader"]["cells"]]
            for row in ex["tableBody"]:
                values = dict(zip(headers, [c["value"] for c in row["cells"]]))
                yield sc["name"], background + sc["steps"], values


def sub(text: str, values: dict) -> str:
    for k, v in values.items():
        text = text.replace(f"<{k}>", v)
    return text


def rows(step, values):
    table = step.get("dataTable")
    return [[sub(c["value"], values) for c in r["cells"]] for r in table["rows"]] if table else []


def check_scenario(path, name, steps, values, failures):
    now, app, outcome, checked = None, None, None, 0
    for step in steps:
        text = sub(step["text"], values)
        if m := re.fullmatch(r'the current time is "([^"]+)"', text):
            now = datetime.fromisoformat(m.group(1).replace("Z", "+00:00"))
            if app and outcome is None:
                pass
        elif text == "an applicant with:":
            kv = {k: v for k, v in rows(step, values)}
            app = {"date of birth": date.fromisoformat(kv["date of birth"]),
                   "credit reference score": int(kv["credit reference score"]),
                   "net monthly income": D(kv["net monthly income"]),
                   "monthly credit commitments": D(kv["monthly credit commitments"]),
                   "essential monthly expenditure": D(kv["essential monthly expenditure"])}
        elif (m := SUBMIT.match(text)) and app is not None:
            amount, term = D(m.group(1)), int(m.group(2))
            if not (D("1000.00") <= amount <= D("25000.00")) or not (12 <= term <= 60):
                outcome = "INVALID"
                continue
            app["repayment"] = D(m.group(3))
            outcome = evaluate(app, now)
        elif outcome == "INVALID" or outcome is None:
            continue
        elif m := re.fullmatch(r'the credit band is "([A-D])"', text):
            checked += expect(outcome["band"], m.group(1), text, path, name, values, failures)
        elif m := re.fullmatch(r'the debt service ratio is ([\d.]+) percent', text):
            checked += expect(outcome["dsr"], m.group(1), text, path, name, values, failures)
        elif m := re.fullmatch(r'the recommendation is "(\w+)"', text):
            checked += expect(outcome["recommendation"], m.group(1), text, path, name, values, failures)
        elif m := re.fullmatch(r'the decline reasons are "([^"]*)"', text):
            want = [] if m.group(1) == "none" else [r.strip() for r in m.group(1).split(",")]
            checked += expect(outcome["reasons"], want, text, path, name, values, failures)
        elif m := re.fullmatch(r'the application status is "(\w+)"', text):
            checked += expect(outcome["status"], m.group(1), text, path, name, values, failures)
        elif text == "the audit trail records the rule results:":
            for rule, result, observed, threshold in rows(step, values)[1:]:
                checked += expect(outcome["rules"][rule], (result, observed, threshold),
                                  f"{rule} row", path, name, values, failures)
        elif m := re.fullmatch(r'the decline notice gives the reasons:', text):
            codes = [r[0] for r in rows(step, values)[1:]]
            checked += expect(outcome["reasons"], codes, text, path, name, values, failures)
    return checked


def expect(actual, wanted, what, path, name, values, failures) -> int:
    if actual != wanted:
        failures.append(f"{path} :: {name} {values or ''}\n    {what}: expected in Gherkin {wanted!r}, oracle {actual!r}")
    return 1


def check_fixtures(failures) -> int:
    now = datetime.fromisoformat("2026-10-01T09:00:00+00:00")
    dob = date(1991, 3, 15)
    n = 0
    std = evaluate({"date of birth": dob, "credit reference score": 800,
                    "net monthly income": D("3000.00"), "monthly credit commitments": D("450.00"),
                    "essential monthly expenditure": D("1200.00"), "repayment": D("300.00")}, now)
    n += expect((std["recommendation"], std["dsr"]), ("ACCEPT", "25.00"), "standard applicant", "§13", "fixture", {}, failures)
    for amount in ("1000.00", "5000.00", "10000.00", "10000.01", "15000.00", "20000.00", "20000.01", "25000.00"):
        rep = (D(amount) * D("0.024")).quantize(TWO, ROUND_HALF_EVEN)
        r = evaluate({"date of birth": dob, "credit reference score": 800,
                      "net monthly income": D("5000.00"), "monthly credit commitments": D("500.00"),
                      "essential monthly expenditure": D("1500.00"), "repayment": rep}, now)
        n += expect(r["recommendation"], "ACCEPT", f"accepted fixture {amount}", "§13", "fixture", {}, failures)
    ref = {"date of birth": dob, "net monthly income": D("4000.00"), "monthly credit commitments": D("800.00"),
           "essential monthly expenditure": D("1500.00"), "repayment": D("600.00")}
    n += expect(evaluate({**ref, "credit reference score": 650}, now)["recommendation"], "REFER", "referred fixture", "§13", "fixture", {}, failures)
    dec = evaluate({**ref, "credit reference score": 500}, now)
    n += expect((dec["recommendation"], dec["reasons"]), ("DECLINE", ["CREDIT_HISTORY"]), "declined fixture", "§13", "fixture", {}, failures)
    return n


def main() -> int:
    failures: list[str] = []
    checked = check_fixtures(failures)
    scenarios = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "**", "*.feature"), recursive=True)):
        doc = Parser().parse(open(path, encoding="utf-8").read())
        rel = os.path.relpath(path, ROOT)
        for name, steps, values in expand(doc["feature"]):
            n = check_scenario(rel, name, steps, values, failures)
            if n:
                scenarios += 1
                checked += n
    # Demonstrates why DR-008 forbids floats.
    float_dsr = f"{(400.30 + 300.00) / 2000.00 * 100:.2f}"
    print(f"Checked {checked} expected values across {scenarios} scenarios and the §13 fixtures.")
    print(f"Float trap: (400.30 + 300.00) / 2000.00 x 100 formats as {float_dsr} in IEEE 754; decimal half-even gives 35.02.")
    if failures:
        print(f"\nFAIL — {len(failures)} mismatch(es):")
        print("\n".join(failures))
        return 1
    print("PASS — every checked expected value agrees with the reference model.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
