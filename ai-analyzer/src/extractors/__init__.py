from .business_plan import detect as detect_business_plan, extract as extract_business_plan
from .utility_bill import detect as detect_utility_bill, extract as extract_utility_bill
from .installer_contract import (
    detect as detect_installer_contract,
    extract as extract_installer_contract,
)

EXTRACTORS = {
    "business_plan": {
        "detect": detect_business_plan,
        "extract": extract_business_plan,
    }
}
EXTRACTORS.update({
    "utility_bill": {"detect": detect_utility_bill, "extract": extract_utility_bill},
    "installer_contract": {
        "detect": detect_installer_contract,
        "extract": extract_installer_contract,
    },
})

__all__ = [
    "EXTRACTORS",
    "detect_business_plan",
    "extract_business_plan",
    "detect_utility_bill",
    "extract_utility_bill",
    "detect_installer_contract",
    "extract_installer_contract",
]
