from .business_plan import detect as detect_business_plan, extract as extract_business_plan
from .utility_bill import detect as detect_utility_bill, extract as extract_utility_bill
from .installer_contract import (
    detect as detect_installer_contract,
    extract as extract_installer_contract,
)
from .equipment_specs import detect as detect_equipment_specs, extract as extract_equipment_specs
from .invoices_or_quotes import detect as detect_invoices_or_quotes, extract as extract_invoices_or_quotes
from .energy_savings_report import (
    detect as detect_energy_savings_report,
    extract as extract_energy_savings_report,
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
    "equipment_specs": {
        "detect": detect_equipment_specs,
        "extract": extract_equipment_specs,
    },
    "invoices_or_quotes": {
        "detect": detect_invoices_or_quotes,
        "extract": extract_invoices_or_quotes,
    },
    "energy_savings_report": {
        "detect": detect_energy_savings_report,
        "extract": extract_energy_savings_report,
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
    "detect_equipment_specs",
    "extract_equipment_specs",
    "detect_invoices_or_quotes",
    "extract_invoices_or_quotes",
    "detect_energy_savings_report",
    "extract_energy_savings_report",
]
