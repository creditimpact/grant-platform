from pathlib import Path

from src.extractors.veteran_cert_application import extract

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "veteran" / "application_aug2023.pdf"


def test_application_extractor_parses_core_fields():
    text = FIXTURE.read_text(encoding="utf-8")
    result = extract(text)

    app = result["fields_clean"]["veteranCert"]["application"]
    doc = app["doc"]
    assert doc["type"] == "VOSB_SDVOSB_Application"
    assert doc["issuer"] == "SBA"
    assert doc["program"] == "VetCert"

    business = app["business"]
    assert business["legalName"]["value"] == "Valor Tech Industries LLC"
    assert result["fields_clean"]["business.ein"] == "12-3456789"
    assert result["fields_clean"]["business.phone"] == "+13035550199"
    assert set(result["fields_clean"]["business.naics"]) == {"541330", "541512"}

    owners = app["owners"]
    assert owners[0]["ownershipPct"]["value"] == 60.0
    assert owners[0]["isVeteran"]["value"] is True
    assert owners[0]["isServiceDisabledVeteran"]["value"] is True
    assert result["fields_clean"]["owners"][0]["percent"] == 60.0

    control = app["control"]
    assert control["signsChecks"]["value"] is True
    assert control["executesContracts"]["value"] is True

    loans = result["fields_clean"]["loans"]
    assert loans[0]["originalAmount"] == 12_500_000
    assert loans[0]["currentBalance"] == 8_500_000

    affidavit = app["affidavit"]
    assert affidavit["present"]["value"] is True
    assert affidavit["signerName"]["value"] == "Jordan Carter"
    assert affidavit["signDate"]["value"] == "2023-08-15"

    veteran = app["veteran"]
    assert veteran["dd214Present"]["value"] is True
    assert veteran["vaDisabilityLetterPresent"]["value"] is False
    assert result["fields_clean"]["requestedType"] == "SDVOSB"

    warnings = result["warnings"]
    assert "missing_va_disability_letter" in warnings
    assert "ownership_below_51" not in warnings
