"""pptx_generator.py — Façade de compatibilité MARCEL v2.

Le code a été découpé en 3 modules :
  - pptx_base.py          : constantes, helpers partagés
  - pptx_copil.py         : slides + generate_copil_pptx
  - pptx_status_report.py : slides Status Report + generate_status_report_pptx

Ce fichier ré-exporte les deux fonctions publiques pour rétrocompatibilité.
"""
from pptx_copil import generate_copil_pptx            # noqa: F401
from pptx_status_report import generate_status_report_pptx  # noqa: F401

__all__ = ["generate_copil_pptx", "generate_status_report_pptx"]
