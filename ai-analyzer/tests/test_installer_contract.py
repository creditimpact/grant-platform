import os

import os

from src.detectors import identify
from src.extractors.installer_contract import detect, extract


def load_sample():
    p = os.path.join(
        os.path.dirname(__file__),
        "fixtures",
        "installer_contract_sample.txt",
    )
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def test_detect_installer_contract():
    text = load_sample()
    assert detect(text)
    det = identify(text)
    assert det["type_key"] == "Installer_Contract"
    assert det["confidence"] >= 0.5


def test_extract_installer_contract_fields():
    text = load_sample()
    result = extract(text)
    fields = result["fields"]
    assert fields["provider_name"] == "Solar Installers Inc."
    assert fields["client_name"] == "Green Energy LLC"
    assert fields["service_description"].startswith("Provide and install solar panels")
    assert fields["contract_start_date"] == "2025-01-15"
    assert fields["contract_end_date"] == "2025-04-30"
    assert fields["total_amount"] == 68900.0
    assert fields["contract_number"] == "AG-2025-014"
    assert fields["signature_dates"] == ["2025-01-10", "2025-01-12"]
    assert result["confidence"] >= 0.8


def test_detect_negative_sample():
    assert not detect("This is not a contract at all")
