"""Compatibility package for ai-analyzer.

This package makes the modules located in the legacy ``ai-analyzer``
folder importable as ``ai_analyzer``.
"""
from pathlib import Path

# Allow importing submodules from the ``ai-analyzer`` directory.
__path__ = [str(Path(__file__).resolve().parent.parent / "ai-analyzer")]
