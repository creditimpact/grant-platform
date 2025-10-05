"""Common shared schema fragments for document metadata."""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, constr, field_validator


class EINPayload(BaseModel):
    """Normalized Employer Identification Number payload."""

    ein: constr(pattern=r"^[0-9]{2}-?[0-9]{7}$") = Field(..., description="Employer Identification Number")
    issuing_agency: str = Field(default="IRS", description="Agency that issued the EIN")

    @field_validator("ein")
    @classmethod
    def normalize_ein(cls, value: str) -> str:
        digits = value.replace("-", "")
        return f"{digits[:2]}-{digits[2:]}"


class MonetaryAmount(BaseModel):
    """Represents a currency amount extracted from a document."""

    amount: float = Field(..., ge=0.0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    effective_date: Optional[date] = Field(default=None)
