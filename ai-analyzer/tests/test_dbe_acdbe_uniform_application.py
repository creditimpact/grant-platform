import sys
import sys
from pathlib import Path

import env_setup  # noqa: F401
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.append(str(BASE_DIR / "eligibility-engine"))

from normalization.ingest import normalize_payload  # noqa: E402
from ai_analyzer.main import app  # noqa: E402
from src.detectors import identify  # noqa: E402
from src.extractors.dbe_acdbe_uniform_application import detect, extract  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "dbe_acdbe_uniform_application"
DIGITAL = (FIXTURES / "digital_clean.txt").read_text()
SCAN = (FIXTURES / "scan_no_acdbe.txt").read_text()
NEGATIVE = (FIXTURES / "unrelated.txt").read_text()

client = TestClient(app)


def test_detector_positive_digital():
    assert detect(DIGITAL) is True
    det = identify(DIGITAL)
    assert det["type_key"] == "DBE_ACDBE_Uniform_Application"
    assert det["confidence"] > 0.8


def test_detector_positive_scan_variant():
    assert detect(SCAN) is True
    det = identify(SCAN)
    assert det["type_key"] == "DBE_ACDBE_Uniform_Application"


def test_detector_negative():
    assert detect(NEGATIVE) is False
    assert identify(NEGATIVE) == {}


def test_extraction_core_sections():
    payload = extract(DIGITAL, evidence_key="uploads/dbe.pdf")
    assert payload["doc_type"] == "DBE_ACDBE_Uniform_Application"
    assert payload["confidence"] >= 0.9
    clean = payload["fields_clean"]
    biz = clean["biz"]
    assert biz["legalName"] == "Horizon Equity Builders LLC"
    assert biz["primaryPhone"] == "555-210-4455"
    assert biz["altPhone"] == "555-777-8899"
    assert biz["fax"] == "555-888-9900"
    assert biz["forProfit"] is True
    assert biz["establishedDate"] == "2012-03-14"
    assert biz["ownerSinceDate"] == "2016-06-01"
    assert biz["acquisitionMethod"]["type"] == "bought"
    assert biz["employeeCounts"] == {"fullTime": 12, "partTime": 4, "seasonal": 3, "total": 19}
    assert len(biz["grossReceipts"]) == 3
    assert biz["streetAddressParsed"]["state"] == "CO"

    dbe = clean["dbe"]["application"]
    assert set(dbe["programsSelected"]) == {"DBE", "ACDBE"}
    assert dbe["homeStateUCP"] == "Western States Unified Certification Program"
    assert dbe["siteVisitDates"][0]["state"] == "CA"
    assert dbe["siteVisitDates"][0]["date"] == "2023-04-01"

    owners = clean["owners"]
    assert len(owners) == 2
    assert owners[0]["fullName"] == "Maria Gomez"
    assert owners[0]["ownershipPct"] == 60.0
    assert owners[0]["citizenship"] == "citizen"
    assert owners[0]["personalNetWorth"] == {"present": True}
    assert owners[1]["trustExists"] is True
    assert owners[1]["otherAffiliations"][0]["overTenHoursPerWeek"] is True
    assert "123-45-6789" not in str(payload["fields"])  # SSN masked

    control = clean["control"]
    assert control["reliesOnPEOOrCoMgmt"] is False
    assert control["bonding"]["aggregateLimit"] == 1500000.0
    assert control["bonding"]["projectLimit"] == 500000.0
    assert control["loans"][0]["originalAmount"] == 250000.0
    assert control["loans"][1]["currentBalance"] == 180000.0
    assert control["assetTransfers"][0]["date"] == "2022-12-15"
    assert len(control["equipment"]) == 2
    assert control["offices"][0]["ownedBy"] == "leased"
    assert control["storage"][0]["ownedBy"] == "leased"
    assert control["duties"]["policy_decisions"]["frequency"] == "always"
    assert control["duties"]["field_operations"]["frequency"] == "never"
    assert control["officers"][0]["name"] == "Maria Gomez"
    assert control["directors"][1]["name"] == "Jordan Lee"
    assert "Denver Transit Authority" in control["largestContracts"][0]
    assert "Rocky Mountain Rail JV" in control["activeJobs"][0]

    acdbe = clean["acdbe"]
    assert "Denver International Airport" in acdbe["concessionSpaces"][0]
    affidavit = clean["affidavit"]
    assert affidavit["present"] is True
    assert affidavit["signer"] == "Maria Gomez"
    assert affidavit["date"] == "2024-04-04"

    eligibility = clean["eligibility"]
    assert eligibility["company.name"] == "Horizon Equity Builders LLC"
    assert eligibility["company.address"]["state"] == "CO"
    assert eligibility["owners"][0]["percent"] == 60.0
    assert eligibility["bank.bonding"]["aggregateLimit"] == 1500000.0
    assert payload["field_sources"]["dbe.application.programsSelected"] == "Section 1"
    assert payload["field_confidence"]["biz"] >= 0.85
    assert payload["metadata"]["layoutProvided"] is False
    assert payload["warnings"] == []
    assert clean["doc"]["pii"] is True


def test_extraction_scan_and_state_neutrality():
    payload = extract(SCAN)
    clean = payload["fields_clean"]
    assert clean["biz"]["legalName"] == "Alpine Transit Services Inc."
    assert clean["control"]["reliesOnPEOOrCoMgmt"] is True
    assert "acdbe" not in clean  # no ACDBE section in this scan
    assert clean["dbe"]["application"]["programsSelected"] == ["DBE"]


def test_end_to_end_normalization_round_trip():
    resp = client.post("/analyze", json={"text": DIGITAL})
    assert resp.status_code == 200
    body = resp.json()
    assert body["doc_type"] == "DBE_ACDBE_Uniform_Application"
    eligibility_aliases = body["fields_clean"]["eligibility"]
    normalized = normalize_payload(eligibility_aliases)
    assert normalized["company_name"] == "Horizon Equity Builders LLC"
    assert normalized["company_address"]["state"] == "CO"
    assert normalized["owners_list"][0]["percent"] == 60.0
    assert normalized["bank_bonding"]["aggregateLimit"] == 1500000.0


def test_personal_net_worth_redaction():
    payload = extract(DIGITAL)
    text_repr = str(payload["fields"])
    assert "$1,200,000" not in text_repr
    assert "$800,000" not in text_repr
