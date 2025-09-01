from .business_plan import detect as detect_business_plan, extract as extract_business_plan

EXTRACTORS = {
    "business_plan": {
        "detect": detect_business_plan,
        "extract": extract_business_plan,
    }
}

__all__ = ["EXTRACTORS", "detect_business_plan", "extract_business_plan"]
