# Eligibility Engine

This engine loads grant definitions from the `grants/` directory and matches
user business data against each program. Grants are described in simple JSON
files so new programs can be added without changing the code.

## Usage

Run the engine directly to see a basic example:

```bash
python engine.py
```

Or run the test suite:

```bash
python -m pytest
```
