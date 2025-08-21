import requests
from pathlib import Path
import sys

SERVER_URL = "http://localhost:5000"
AGENT_URL = "http://localhost:5001"
PDF_PATH = Path(r"C:/Users/yedid/Downloads/payroll_records_bluewave_fixed.pdf")

def _print_response(tag: str, resp: requests.Response):
    try:
        data = resp.json()
    except ValueError:
        data = resp.text
    status = "OK" if resp.ok else "ERROR"
    print(f"[{tag} {status}] status={resp.status_code}")
    print(data)
    return data

def upload_file(path: Path) -> str | None:
    print("\n-- Uploading file --")
    if not path.exists():
        print(f"[UPLOAD ERROR] File not found: {path}")
        return None
    files = {"file": (path.name, open(path, "rb"), "application/pdf")}
    try:
        resp = requests.post(f"{SERVER_URL}/api/files/upload", files=files, timeout=30)
    except requests.RequestException as exc:
        print(f"[UPLOAD ERROR] {exc}")
        return None
    finally:
        files["file"][1].close()
    data = _print_response("UPLOAD", resp)
    if resp.ok:
        case_id = data.get("caseId") if isinstance(data, dict) else None
        if not case_id:
            print("[UPLOAD ERROR] caseId missing in response")
        return case_id
    return None

def get_case_status(case_id: str) -> dict | None:
    print("\n-- Fetching case status --")
    try:
        resp = requests.get(f"{SERVER_URL}/api/case/status", params={"caseId": case_id}, timeout=30)
    except requests.RequestException as exc:
        print(f"[STATUS ERROR] {exc}")
        return None
    data = _print_response("STATUS", resp)
    if resp.ok and isinstance(data, dict):
        analyzer = data.get("analyzerFields", {})
        print("Analyzer Fields:", analyzer)
        return data
    return None

def run_eligibility(case_id: str) -> tuple[dict | None, list[str]]:
    print("\n-- Running eligibility report --")
    try:
        resp = requests.post(f"{SERVER_URL}/api/eligibility-report", json={"caseId": case_id}, timeout=30)
    except requests.RequestException as exc:
        print(f"[ELIGIBILITY ERROR] {exc}")
        return None, []
    data = _print_response("ELIGIBILITY", resp)
    forms: list[str] = []
    if resp.ok and isinstance(data, dict):
        eligibility = data.get("eligibility", {})
        results = eligibility.get("results")
        forms = eligibility.get("requiredForms", []) or []
        print("Results:", results)
        print("Required Forms:", forms)
        return eligibility, forms
    return None, forms

def fetch_template(form_key: str) -> dict | None:
    print(f"\n-- Fetching form template {form_key} --")
    try:
        resp = requests.get(f"{SERVER_URL}/api/form-template/{form_key}", timeout=30)
    except requests.RequestException as exc:
        print(f"[TEMPLATE ERROR] {exc}")
        return None
    data = _print_response("TEMPLATE", resp)
    return data if resp.ok else None

def simulate_form_fill(form_key: str):
    print(f"\n-- Simulating form fill for {form_key} --")
    payload = {"form_name": form_key, "user_payload": {"dummy": "data"}}
    try:
        resp = requests.post(f"{AGENT_URL}/form-fill", json=payload, timeout=30)
    except requests.RequestException as exc:
        print(f"[FORMFILL ERROR] {exc}")
        return
    _print_response("FORMFILL", resp)

def main():
    case_id = upload_file(PDF_PATH)
    if not case_id:
        return
    get_case_status(case_id)
    _, forms = run_eligibility(case_id)
    if forms:
        form_key = forms[0]
        fetch_template(form_key)
        simulate_form_fill(form_key)

if __name__ == "__main__":
    main()
