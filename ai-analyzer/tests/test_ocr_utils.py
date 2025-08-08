"""Tests for OCR helper functions."""

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ocr_utils import extract_text


def test_extract_text_falls_back_to_utf8_decode():
    data = b"hello world"
    assert extract_text(data) == "hello world"


def test_extract_text_handles_binary_data():
    # Non-decodable bytes should return placeholder text
    data = bytes([0, 255, 0, 255])
    assert extract_text(data)

