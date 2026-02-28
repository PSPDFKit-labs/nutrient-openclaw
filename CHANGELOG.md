# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added
- GitHub tag-based release workflow for automated npm publish and GitHub release creation.
- Release runbook (`RELEASING.md`) and version sync script for plugin manifest consistency.

## [0.1.1] - 2026-02-28

### Fixed
- Normalized `nutrient_extract_text.language` schema to avoid OpenClaw schema validation errors (`array schema missing items`).
- Preserved multi-language OCR support by accepting comma-separated language strings.
- Added support for HTML inputs in `nutrient_convert_to_pdf`.

### Changed
- Simplified request `User-Agent` to `NutrientOpenClawPlugin` to avoid hardcoded version churn in code/tests.

## [0.1.0] - 2026-02-04

### Added
- Initial release of `@nutrient-sdk/nutrient-openclaw`.
- Core tools: conversion, extraction, OCR, redaction, signing, watermarking, and credits checks.
