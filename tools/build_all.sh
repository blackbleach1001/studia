#!/bin/sh
# Pełna przebudowa strony: części przedmiotów → fiszki i sprawdzanie sekcji → wersje plików
set -e
cd "$(dirname "$0")/.."
python3 tools/build_units.py
python3 tools/build_models.py
python3 tools/build_cards.py
python3 tools/build_search.py
python3 tools/build_plan.py
python3 tools/version_assets.py
