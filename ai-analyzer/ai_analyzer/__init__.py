"""Compatibility package to expose modules in parent directory as ai_analyzer."""
from pathlib import Path

__path__ = [str(Path(__file__).resolve().parent.parent)]
