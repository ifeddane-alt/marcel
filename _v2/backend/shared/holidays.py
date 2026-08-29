"""
Jours fériés France et Maroc — 2025 & 2026.
Hardcodés pour V1 (les fêtes islamiques sont des approximations).
"""
from typing import NamedTuple


class Holiday(NamedTuple):
    date: str    # YYYY-MM-DD
    name: str
    country: str  # "FR" | "MA" | "ALL"


# ─── France ─────────────────────────────────────────────────────────────────
HOLIDAYS_FR = [
    # 2025
    Holiday("2025-01-01", "Jour de l'An",           "FR"),
    Holiday("2025-04-21", "Lundi de Pâques",         "FR"),
    Holiday("2025-05-01", "Fête du Travail",          "FR"),
    Holiday("2025-05-08", "Victoire 1945",            "FR"),
    Holiday("2025-05-29", "Ascension",               "FR"),
    Holiday("2025-06-09", "Lundi de Pentecôte",       "FR"),
    Holiday("2025-07-14", "Fête Nationale",           "FR"),
    Holiday("2025-08-15", "Assomption",              "FR"),
    Holiday("2025-11-01", "Toussaint",               "FR"),
    Holiday("2025-11-11", "Armistice 1918",           "FR"),
    Holiday("2025-12-25", "Noël",                    "FR"),
    # 2026
    Holiday("2026-01-01", "Jour de l'An",            "FR"),
    Holiday("2026-04-06", "Lundi de Pâques",          "FR"),
    Holiday("2026-05-01", "Fête du Travail",           "FR"),
    Holiday("2026-05-08", "Victoire 1945",             "FR"),
    Holiday("2026-05-14", "Ascension",                "FR"),
    Holiday("2026-05-25", "Lundi de Pentecôte",        "FR"),
    Holiday("2026-07-14", "Fête Nationale",            "FR"),
    Holiday("2026-08-15", "Assomption",               "FR"),
    Holiday("2026-11-01", "Toussaint",                "FR"),
    Holiday("2026-11-11", "Armistice 1918",            "FR"),
    Holiday("2026-12-25", "Noël",                     "FR"),
]

# ─── Maroc ───────────────────────────────────────────────────────────────────
HOLIDAYS_MA = [
    # 2025 — fêtes civiles fixes
    Holiday("2025-01-01", "Nouvel An",                           "MA"),
    Holiday("2025-01-11", "Manifeste de l'Indépendance",         "MA"),
    Holiday("2025-05-01", "Fête du Travail",                     "MA"),
    Holiday("2025-07-30", "Fête du Trône",                       "MA"),
    Holiday("2025-08-14", "Allégeance Oued Eddahab",             "MA"),
    Holiday("2025-08-20", "Révolution du Roi et du Peuple",      "MA"),
    Holiday("2025-08-21", "Fête de la Jeunesse",                 "MA"),
    Holiday("2025-11-06", "Marche Verte",                        "MA"),
    Holiday("2025-11-18", "Fête de l'Indépendance",              "MA"),
    # 2025 — fêtes islamiques (approximations)
    Holiday("2025-03-30", "Aïd Al-Fitr (J1)",                   "MA"),
    Holiday("2025-03-31", "Aïd Al-Fitr (J2)",                   "MA"),
    Holiday("2025-06-06", "Aïd Al-Adha (J1)",                   "MA"),
    Holiday("2025-06-07", "Aïd Al-Adha (J2)",                   "MA"),
    Holiday("2025-06-26", "1er Moharram 1447",                   "MA"),
    Holiday("2025-09-04", "Mawlid An-Nabawi",                    "MA"),
    # 2026 — fêtes civiles fixes
    Holiday("2026-01-01", "Nouvel An",                           "MA"),
    Holiday("2026-01-11", "Manifeste de l'Indépendance",         "MA"),
    Holiday("2026-05-01", "Fête du Travail",                     "MA"),
    Holiday("2026-07-30", "Fête du Trône",                       "MA"),
    Holiday("2026-08-14", "Allégeance Oued Eddahab",             "MA"),
    Holiday("2026-08-20", "Révolution du Roi et du Peuple",      "MA"),
    Holiday("2026-08-21", "Fête de la Jeunesse",                 "MA"),
    Holiday("2026-11-06", "Marche Verte",                        "MA"),
    Holiday("2026-11-18", "Fête de l'Indépendance",              "MA"),
    # 2026 — fêtes islamiques (approximations)
    Holiday("2026-03-20", "Aïd Al-Fitr (J1)",                   "MA"),
    Holiday("2026-03-21", "Aïd Al-Fitr (J2)",                   "MA"),
    Holiday("2026-05-27", "Aïd Al-Adha (J1)",                   "MA"),
    Holiday("2026-05-28", "Aïd Al-Adha (J2)",                   "MA"),
    Holiday("2026-06-16", "1er Moharram 1448",                   "MA"),
    Holiday("2026-08-24", "Mawlid An-Nabawi",                    "MA"),
]

ALL_HOLIDAYS: list[Holiday] = HOLIDAYS_FR + HOLIDAYS_MA

# Index rapide date → liste de fêtes
_HOLIDAY_INDEX: dict[str, list[Holiday]] = {}
for _h in ALL_HOLIDAYS:
    _HOLIDAY_INDEX.setdefault(_h.date, []).append(_h)


def get_holidays_for_dates(dates: list[str]) -> dict[str, list[dict]]:
    """
    Retourne un dict {date: [{name, country}]} pour les dates qui ont un jour férié.
    Combine FR + MA.
    """
    result: dict[str, list[dict]] = {}
    for d in dates:
        if d in _HOLIDAY_INDEX:
            result[d] = [{"name": h.name, "country": h.country} for h in _HOLIDAY_INDEX[d]]
    return result


def get_holidays_for_month(year: int, month: int) -> dict[str, list[dict]]:
    """Retourne tous les jours fériés d'un mois donné."""
    import calendar as cal
    last_day = cal.monthrange(year, month)[1]
    dates = [f"{year}-{month:02d}-{d:02d}" for d in range(1, last_day + 1)]
    return get_holidays_for_dates(dates)


def is_holiday(date_str: str) -> bool:
    return date_str in _HOLIDAY_INDEX


def count_working_days(dates: list[str], leaves: dict[str, float]) -> dict:
    """
    Compte les JH disponibles sur une liste de dates (jours ouvrés uniquement),
    en soustrayant les jours fériés et les absences.
    Retourne: {total_working, holiday_days, absence_jh, available_jh}
    """
    from datetime import date as dt
    total_working  = 0
    holiday_days   = 0
    absence_jh     = 0.0

    for d in dates:
        day = dt.fromisoformat(d)
        if day.weekday() >= 5:  # week-end
            continue
        if d in _HOLIDAY_INDEX:
            holiday_days += 1
            continue
        total_working += 1
        absence_jh += leaves.get(d, 0.0)

    available_jh = max(0.0, total_working - absence_jh)
    return {
        "total_working":  total_working,
        "holiday_days":   holiday_days,
        "absence_jh":     absence_jh,
        "available_jh":   available_jh,
    }
