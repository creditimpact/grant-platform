import os

from src.detectors import identify
from src.extractors.equipment_specs import detect, extract


def load_sample():
    p = os.path.join(
        os.path.dirname(__file__),
        "fixtures",
        "equipment_specs_sample.txt",
    )
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def test_detect_equipment_specs():
    text = load_sample()
    assert detect(text)
    det = identify(text)
    assert det["type_key"] == "Equipment_Specs"
    assert det["confidence"] >= 0.5


def test_extract_equipment_specs_fields():
    text = load_sample()
    result = extract(text)
    fields = result["fields"]
    assert fields["equipment_name"] == "Solar PV Panel"
    assert fields["model_number"] == "SP-450W"
    assert fields["capacity_kw"] == 0.45
    assert fields["efficiency_percent"] == 21.6
    assert fields["certifications"] == ["UL 1703", "IEC 61215"]
    assert fields["manufacturer"] == "SolarTech"
    assert fields["issue_date"] == "2024-01-15"
    assert result["confidence"] >= 0.8


def test_detect_negative_sample():
    assert not detect("This has no relevant info")
