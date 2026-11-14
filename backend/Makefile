# Earth Information Jukebox — data/backend pipeline
# Override any variable on the command line, e.g.:
#   make fetch ID=5196
#   make build ID=5196 VIZ=co2 TITLE="DYAMOND Global CO2 (Jan-Mar 2020)" HOT=bright
#
ID      ?= 5196
VIZ     ?= co2
TITLE   ?= NASA EIC visualization
SRC_URL ?= https://svs.gsfc.nasa.gov/$(ID)
HOT     ?= bright
THR     ?= 0.6
FPS     ?= 12
SCALE   ?= 640x360
MAXF    ?= 320
RAW     ?= data/raw

PY ?= python3

.PHONY: help setup list fetch frames features manifest mock build clean

help:
	@echo "Targets: setup | list ID= | fetch ID= | frames VIZ= SRC= | features VIZ= | manifest | mock | build ID= VIZ= | clean"

setup:
	$(PY) -m pip install -r requirements.txt

list:
	$(PY) svs_fetch.py $(ID) --list

fetch:
	$(PY) svs_fetch.py $(ID) --out-dir $(RAW) --max-height 1080

# SRC must point at the downloaded mp4 (see output of `make fetch`)
frames:
	$(PY) extract_frames.py --src $(SRC) --viz $(VIZ) --out public/frames/$(VIZ) \
		--fps $(FPS) --scale $(SCALE) --format jpg --max-frames $(MAXF)

features:
	$(PY) extract_features.py --frames public/frames/$(VIZ) --viz $(VIZ)-svs$(ID) \
		--title "$(TITLE)" --source-url "$(SRC_URL)" --fps $(FPS) \
		--hot-mode $(HOT) --hot-threshold $(THR) --out public/features/$(VIZ).json

manifest:
	$(PY) make_manifest.py

mock:
	$(PY) make_mock.py --out public/features/mock.json

# Full chain for one visualization. You must pass SRC (the mp4 from `make fetch`).
build: frames features manifest
	@echo "Built $(VIZ). Give public/ to Person C."

clean:
	rm -rf public/frames/* public/features/* public/manifest.json $(RAW)/*

# Optional: sonify real NASA gridded data values (netCDF) -> same contract
# usage: make netcdf SRC=data/raw/file.nc VAR=CO2 VIZ=co2-values SRC_URL=<nasa url>
netcdf:
	$(PY) ingest_netcdf.py --src $(SRC) --var $(VAR) --viz $(VIZ) \
		--source-url "$(SRC_URL)" --out public/features/$(VIZ).json

# One command: fetch NASA data -> frames -> features -> manifest -> verify
# usage: make all ID=5196 VIZ=co2 TITLE="DYAMOND Global Carbon Dioxide (NASA SVS 5196)"
all: fetch
	@SRC=`cat $(RAW)/.latest`; echo "using $$SRC"; \
	$(PY) extract_frames.py --src $$SRC --viz $(VIZ) --out public/frames/$(VIZ) \
		--fps $(FPS) --scale $(SCALE) --format jpg --max-frames $(MAXF); \
	$(PY) extract_features.py --frames public/frames/$(VIZ) --viz $(VIZ)-svs$(ID) \
		--title "$(TITLE)" --source-url "$(SRC_URL)" --fps $(FPS) \
		--hot-mode $(HOT) --hot-threshold $(THR) --out public/features/$(VIZ).json; \
	$(PY) make_manifest.py; \
	$(PY) verify_output.py

verify:
	$(PY) verify_output.py

test:
	$(PY) tests/smoke_test.py
