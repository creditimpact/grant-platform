import os
from src.detectors import identify
from src.extractors.energy_savings_report import detect, extract


def load_sample(name="energy_savings_report_sample.txt"):
    p = os.path.join(os.path.dirname(__file__), "fixtures", name)
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def test_detect_energy_savings_report():
    text = load_sample()
    assert detect(text)
    det = identify(text)
    assert det["type_key"] == "Energy_Savings_Report"
    assert det["confidence"] >= 0.5


def test_extract_energy_savings_report_fields():
    text = load_sample()
    result = extract(text)
    fields = result["fields"]
    assert fields["baseline_kwh_annual"] == 180000.0
    assert fields["post_kwh_annual"] == 132000.0
    assert fields["kwh_saved_annual"] == 48000.0
    assert fields["payback_years"] == 4.9
    assert "ASHRAE 90.1" in fields["standards_refs"]
    assert result["confidence"] >= 0.85


def test_negative_detection():
    text = load_sample("energy_savings_report_negative.txt")
    assert not detect(text)
