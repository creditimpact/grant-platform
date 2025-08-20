import env_setup  # noqa: F401
from nlp_parser import (
    extract_ein,
    extract_w2_count,
    extract_quarterly_revenues,
    extract_entity_type,
    parse_money,
)


def test_extract_ein_single() -> None:
    text = "Our EIN is 12-3456789 registered"
    value, conf, candidates, amb = extract_ein(text)
    assert value == "12-3456789"
    assert conf > 0.8
    assert candidates == ["12-3456789"]
    assert amb == []


def test_extract_ein_multiple() -> None:
    text = "EIN 12-3456789 duplicate 98-7654321"
    value, _, candidates, amb = extract_ein(text)
    assert value == "12-3456789"
    assert len(candidates) == 2
    assert amb and amb[0]["field"] == "ein"


def test_w2_not_1099() -> None:
    text = "W-2 employees: 15 and 1099 contractors 3"
    count, conf = extract_w2_count(text)
    assert count == 15
    assert conf > 0


def test_quarterly_revenues() -> None:
    text = "Q1 2023 revenue $120k; 2022 Q4 revenue $1.2M"
    revs, conf = extract_quarterly_revenues(text)
    assert revs["2023"]["Q1"] == 120000
    assert revs["2022"]["Q4"] == 1200000
    assert conf["quarterly_revenues.2023.Q1"] == 0.9


def test_entity_type_mapping() -> None:
    text = "Registered as an S-Corp"
    entity, conf = extract_entity_type(text)
    assert entity == "corp_s"
    assert conf > 0


def test_parse_money_helpers() -> None:
    assert parse_money("1.2M") == 1200000
    assert parse_money("55k") == 55000
