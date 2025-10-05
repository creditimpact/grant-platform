"""Utility to verify shared document_library import."""

import os
import sys

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
)

import document_library

print("\u2705 document_library import successful:", document_library.__file__)
