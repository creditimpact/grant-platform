"""Tests for the lightweight NLP parser."""

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from nlp_parser import parse_fields


def test_parse_fields_extracts_known_values():
    text = (
        "Revenue: 123,456 with 10 employees "
        "and founded in 2019."
    )
    fields, confidence = parse_fields(text)

    assert fields["revenue"] == 123456
    assert fields["employees"] == 10
    assert fields["year_founded"] == "2019"
    # confidence should include keys for extracted fields
    assert set(confidence) == set(fields)

