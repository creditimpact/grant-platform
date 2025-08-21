import os
import sys

import pytest

# Allow importing modules from the ai-agent service directory
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from utils.merge import merge_preserving_user


@pytest.mark.parametrize("empty", [None, "", [], {}, ()])
def test_empty_values_are_overwritten(empty):
    user = {"field": empty}
    inferred = {"field": "inferred"}
    merged, steps = merge_preserving_user(user, inferred)

    assert merged["field"] == "inferred"
    assert any('filled "field" from inference' in s for s in steps)


def test_non_empty_values_are_preserved():
    user = {"field": "user"}
    inferred = {"field": "inferred"}
    merged, steps = merge_preserving_user(user, inferred)

    assert merged["field"] == "user"
    assert any('kept user value for "field"' in s for s in steps)

