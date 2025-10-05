"""Schemas for tax return style documents."""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, conint, constr

from .common import EINPayload, MonetaryAmount


class TaxReturnMetadata(BaseModel):
    """Structured data commonly extracted from tax returns."""

    ein: constr(pattern=r"^[0-9]{2}-[0-9]{7}$") = Field(..., description="Employer Identification Number")
    tax_year: conint(ge=1980, le=2100) = Field(...)
    taxpayer_name: str = Field(..., description="Primary filer name")
    gross_income: MonetaryAmount = Field(..., description="Gross income reported for the year")
    return_type: str = Field(..., description="Tax return form variant, e.g. 1040, 1120X")
    filing_date: Optional[date] = None
    preparer_name: Optional[str] = None

    @classmethod
    def from_ein_payload(
        cls,
        *,
        ein_payload: EINPayload,
        tax_year: int,
        taxpayer_name: str,
        gross_income: float,
        return_type: str,
        filing_date: Optional[date] = None,
        preparer_name: Optional[str] = None,
    ) -> "TaxReturnMetadata":
        return cls(
            ein=ein_payload.ein,
            tax_year=tax_year,
            taxpayer_name=taxpayer_name,
            gross_income=MonetaryAmount(amount=gross_income),
            return_type=return_type,
            filing_date=filing_date,
            preparer_name=preparer_name,
        )
