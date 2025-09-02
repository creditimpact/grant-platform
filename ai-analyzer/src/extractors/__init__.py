from .business_plan import detect as detect_business_plan, extract as extract_business_plan
from .utility_bill import detect as detect_utility_bill, extract as extract_utility_bill

EXTRACTORS = {
    "business_plan": {
        "detect": detect_business_plan,
        "extract": extract_business_plan,
    }
}
EXTRACTORS.update({
    "utility_bill": {"detect": detect_utility_bill, "extract": extract_utility_bill}
})

__all__ = [
    "EXTRACTORS",
    "detect_business_plan",
    "extract_business_plan",
    "detect_utility_bill",
    "extract_utility_bill",
]
