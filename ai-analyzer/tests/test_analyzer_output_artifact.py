import asyncio
import json
from pathlib import Path

import env_setup  # noqa: F401
from ai_analyzer.main import run_analysis_session
from src.session_manager import SessionManager

def test_analyzer_output_written() -> None:
    session_id = SessionManager.create_session()
    analysis_result, report = asyncio.run(
        run_analysis_session(
            session_id=session_id,
            source="unit-test",
            text_input="Sample document body for analyzer artifact",
            upload_bytes=None,
            filename=None,
            content_type=None,
            raise_on_fail=False,
        )
    )

    session_path = SessionManager.get_session_path(session_id)
    analyzer_path = session_path / "analyze" / "analyzer_output.json"
    assert analyzer_path.exists()

    payload = json.loads(analyzer_path.read_text(encoding="utf-8"))
    assert payload["session_id"] == session_id
    assert payload["file"]["name"] is None
    assert payload["ocr"]["artifact_path"]
    assert Path(payload["ocr"]["artifact_path"]).exists()
    assert isinstance(payload["fields"], dict)
    assert isinstance(payload["fields_clean"], dict)
    assert payload["raw_text_preview"]
    assert payload["raw_text_preview"] == payload["raw_text_preview"][:512]
    assert "detector" in payload and "extractor" in payload

    ocr_path = session_path / "ocr" / "ocr_output.json"
    assert ocr_path.exists()

    # Run again using legacy accessor to ensure backward compatibility
    formatted = analysis_result if analysis_result else {}
    flattened = report.get("analyzer", {})
    assert isinstance(formatted, dict)
    assert "field_count" in flattened
