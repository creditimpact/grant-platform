import json
import sys
from pathlib import Path
from engine import analyze_eligibility
from common.logger import get_logger

logger = get_logger(__name__)


def main():
    if len(sys.argv) < 2:
        logger.error("usage", extra={"cmd": "python run_check.py <payload.json>"})
        sys.exit(1)
    payload_path = Path(sys.argv[1])
    with payload_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    results = analyze_eligibility(data, explain=True)
    logger.info("eligibility_results", extra={"count": len(results)})


if __name__ == "__main__":
    main()
