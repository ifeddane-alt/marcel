#!/usr/bin/env python3
"""
MARCEL PPM — Générateur de clés de licence client.
Usage : python scripts/generate_license.py
"""
import sys
import os

# Ajouter le backend au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from core.license import generate_license, validate_license


def main():
    print("\n" + "═" * 55)
    print("  MARCEL PPM — Générateur de licence client")
    print("═" * 55 + "\n")

    customer   = input("  Nom du client          : ").strip()
    domain     = input("  Domaine (ex: marcel.client.fr) : ").strip()
    expiry     = input("  Expiration (YYYY-MM-DD): ").strip()
    max_users  = input("  Nombre max d'utilisateurs [999] : ").strip()

    if not all([customer, domain, expiry]):
        print("\n❌ Tous les champs sont obligatoires.")
        sys.exit(1)

    max_users = int(max_users) if max_users.isdigit() else 999

    key = generate_license(customer, domain, expiry, max_users)

    # Vérification immédiate
    payload = validate_license(key)

    print("\n" + "═" * 55)
    print("  ✔ Clé de licence générée\n")
    print(f"  Client     : {payload['customer']}")
    print(f"  Domaine    : {payload['domain']}")
    print(f"  Expiration : {payload['expiry']}")
    print(f"  Utilisateurs max : {payload['max_users']}")
    print(f"  Émise le   : {payload['issued']}")
    print("\n  CLEF À ENVOYER AU CLIENT :")
    print("  " + "─" * 50)
    print(f"\n  {key}\n")
    print("  " + "─" * 50)
    print("\n  ⚠  Conservez cette clé. Ne la partagez pas.")
    print("═" * 55 + "\n")


if __name__ == "__main__":
    main()
