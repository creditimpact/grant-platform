"""Eligibility Engine module."""

from typing import List, Dict
import json
from pathlib import Path


def analyze_eligibility(data: Dict) -> List:
    """Analyze input data and return a list of eligible grants."""

    print(f"analyze_eligibility called with data: {data}")

    config_path = Path(__file__).with_name("grants_config.json")
    raw_lines = config_path.read_text().splitlines()
    json_lines = [line for line in raw_lines if not line.strip().startswith("//")]
    grants_config = json.loads("\n".join(json_lines) or "{}")

    eligible: List[str] = []

    # ERC eligibility check
    if "erc" in grants_config:
        print("Checking ERC eligibility...")
        erc_rule = grants_config["erc"]
        required = erc_rule.get("required_fields", [])
        if all(field in data for field in required):
            if (
                data.get("revenue_drop", 0) >= 20
                and data.get("num_employees", 0) >= 1
                and data.get("operated_during_covid") is True
            ):
                eligible.append("erc")
                print("✅ ERC eligible")
        else:
            print("Required fields missing for ERC")

    return eligible


if __name__ == "__main__":
    sample_data = {
        "revenue_drop": 25,
        "num_employees": 5,
        "operated_during_covid": True,
    }
    print(analyze_eligibility(sample_data))  # Expected: ['erc']
