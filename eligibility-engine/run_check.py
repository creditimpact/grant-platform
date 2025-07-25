import json
import sys
from pathlib import Path
from engine import analyze_eligibility


def main():
    if len(sys.argv) < 2:
        print("Usage: python run_check.py <payload.json>")
        sys.exit(1)
    payload_path = Path(sys.argv[1])
    with payload_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    results = analyze_eligibility(data, explain=True)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
