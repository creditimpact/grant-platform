"""Schemas describing payroll summary artifacts."""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, conint

from .common import MonetaryAmount


class PayrollSummary(BaseModel):
    """Structured fields extracted from payroll registers or IRS filings."""

    quarter: conint(ge=1, le=4) = Field(...)
    year: conint(ge=2000, le=2100) = Field(...)
    employee_count: conint(ge=0) = Field(...)
    total_wages: MonetaryAmount = Field(...)
    total_withholding: MonetaryAmount = Field(...)
    prepared_on: Optional[date] = None
    payroll_provider: Optional[str] = None
