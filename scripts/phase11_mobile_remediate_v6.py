#!/usr/bin/env python3
"""Run the stabilized Phase 11 mobile remediation and normalize generated EOFs."""
import runpy
from pathlib import Path

here = Path(__file__).resolve().parent
runpy.run_path(str(here / "phase11_mobile_remediate_v5.py"), run_name="__main__")

root = here.parent
for relative in [
    "Phone App/iPhone App/PAWatershedWatch/PAWatershedWatch/ProductionData.swift",
]:
    path = root / relative
    path.write_text(path.read_text().rstrip() + "\n")

print("Phase 11 mobile remediation formatting normalized.")
