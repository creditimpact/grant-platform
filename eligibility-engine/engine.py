"""Eligibility Engine module.

This module evaluates business data against grant rules defined in
``grants_config.json``. The goal is to keep the logic self contained so it
can be reused by the backend API or CLI tools.
"""

from __future__ import annotations

from typing import List, Dict, Any
import json
from pathlib import Path
from datetime import datetime


def estimate_rd_credit(data: Dict[str, Any]) -> float:
    """Estimate the potential R&D credit based on QRE totals."""
    qre = data.get("qre_total", 0)
    if data.get("has_prior_rd"):
        return 0.14 * max(qre - data.get("qre_avg_prev_3", 0), 0)
    else:
        return 0.06 * qre


def check_r_and_d_eligibility(data: Dict[str, Any]) -> Dict[str, Any]:
    """Determine if the business qualifies for the R&D tax credit."""
    conditions = [
        data.get("has_product_or_process_dev") is True,
        data.get("is_tech_based") is True,
        data.get("has_technical_uncertainty") is True,
        data.get("uses_experimentation") is True,
    ]
    if all(conditions):
        return {
            "eligible": True,
            "credit_type": "R&D",
            "estimated_amount": estimate_rd_credit(data),
        }
    return {"eligible": False}


def analyze_eligibility(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Analyze input data and return a list of eligible grants.

    Parameters
    ----------
    data:
        Dictionary of business information. Expected keys are defined in
        ``grants_config.json`` and include revenue figures and dates.
    """

    print(f"analyze_eligibility called with data: {data}")

    config_path = Path(__file__).with_name("grants_config.json")
    raw_lines = config_path.read_text().splitlines()
    json_lines = [line for line in raw_lines if not line.strip().startswith("//")]
    grants_config = json.loads("\n".join(json_lines) or "{}")

    eligible: List[Dict[str, Any]] = []

    # --- ERC eligibility check -------------------------------------------------
    if "erc" in grants_config:
        print("Checking ERC eligibility...")
        erc_rule = grants_config["erc"]

        required = erc_rule.get("required_fields", [])
        missing = [field for field in required if field not in data]
        if missing:
            print(f"Required fields missing for ERC: {missing}")
        else:
            revenue = data.get("revenue_by_quarter", {})
            covid_orders = set(data.get("covid_orders", []))
            startup_date_str = data.get("startup_date")
            startup_date = (
                datetime.fromisoformat(startup_date_str).date()
                if startup_date_str
                else None
            )

            qualified_quarters = set()
            qualification_path = None

            # --- Revenue drop path -------------------------------------------
            for year, threshold in [(2020, 50), (2021, 20)]:
                for q in range(1, 5):
                    current_key = f"{year}-Q{q}"
                    base_key = f"2019-Q{q}"
                    if (
                        current_key in revenue
                        and base_key in revenue
                        and revenue[base_key] > 0
                    ):
                        drop = (revenue[base_key] - revenue[current_key]) / revenue[
                            base_key
                        ] * 100
                        if drop >= threshold:
                            qualified_quarters.add(current_key)
                            if qualification_path is None:
                                qualification_path = "revenue_drop"

            # --- Government shutdown path ------------------------------------
            for quarter in covid_orders:
                if quarter.startswith("2020") or quarter.startswith("2021"):
                    qualified_quarters.add(quarter)
                    if qualification_path is None:
                        qualification_path = "government_shutdown"

            # --- Recovery Startup path ---------------------------------------
            if not qualified_quarters and startup_date:
                if startup_date > datetime(2020, 2, 15).date():
                    qualified_quarters.update(["2021-Q3", "2021-Q4"])
                    qualification_path = "startup"

            if qualified_quarters:
                result = {
                    "grant": "erc",
                    "qualified_quarters": sorted(qualified_quarters),
                    "qualification_path": qualification_path,
                }
                eligible.append(result)
                print(f"✅ ERC eligible via {qualification_path}")

    # --- R&D Tax Credit eligibility check ------------------------------------
    if "r_and_d" in grants_config:
        print("Checking R&D eligibility...")
        rd_rule = grants_config["r_and_d"]

        required = rd_rule.get("required_fields", [])
        missing = [field for field in required if field not in data]
        if missing:
            print(f"Required fields missing for R&D: {missing}")
        else:
            rd_result = check_r_and_d_eligibility(data)
            if rd_result.get("eligible"):
                rd_result["grant"] = "r_and_d"
                eligible.append(rd_result)
                print("✅ R&D credit eligible")

    return eligible


if __name__ == "__main__":
    # Example 1: Eligible for 2020 via revenue drop of 55% in Q2
    example1 = {
        "revenue_by_quarter": {
            "2019-Q2": 100000,
            "2020-Q2": 45000,
        },
        "business_type": "s-corp",
        "covid_orders": [],
        "payroll_data": True,
        "ppp_received": False,
        "startup_date": "2019-01-01",
    }
    print("Example 1:", analyze_eligibility(example1))

    # Example 2: Eligible for 2021 via government shutdown in Q2
    example2 = {
        "revenue_by_quarter": {
            "2019-Q2": 100000,
            "2021-Q2": 98000,
        },
        "business_type": "llc",
        "covid_orders": ["2021-Q2"],
        "payroll_data": True,
        "ppp_received": False,
        "startup_date": "2018-05-01",
    }
    print("Example 2:", analyze_eligibility(example2))

    # Example 3: Recovery startup eligible for Q3/Q4 2021
    example3 = {
        "revenue_by_quarter": {
            "2019-Q3": 80000,
            "2021-Q3": 79000,
        },
        "business_type": "c-corp",
        "covid_orders": [],
        "payroll_data": True,
        "ppp_received": False,
        "startup_date": "2020-06-01",
    }
    print("Example 3:", analyze_eligibility(example3))

    # Example 4: Missing required fields (should return empty list)
    example4 = {
        "business_type": "llc",
        "covid_orders": [],
    }
    print("Example 4:", analyze_eligibility(example4))
