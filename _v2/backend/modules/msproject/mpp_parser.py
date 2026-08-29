"""Parseur .mpp autonome (subprocess) — MPXJ via JPype, sortie JSON sur stdout."""
import sys
import json


def main():
    path = sys.argv[1]
    out_path = sys.argv[2]
    import jpype
    import mpxj  # noqa: F401  (configure le classpath MPXJ)
    jpype.startJVM()
    from org.mpxj.reader import UniversalProjectReader

    pf = UniversalProjectReader().read(path)
    if pf is None:
        with open(out_path, "w") as f:
            json.dump({"error": "Format de fichier non reconnu"}, f)
        sys.exit(2)

    def d(v):
        return str(v)[:10] if v is not None else None

    tasks = []
    for t in pf.getTasks():
        if t is None or t.getUniqueID() is None:
            continue
        uid = int(str(t.getUniqueID()))
        name = str(t.getName()) if t.getName() is not None else ""
        if not name or uid == 0:
            continue
        tasks.append({
            "uid": uid,
            "name": name,
            "outline": int(str(t.getOutlineLevel())) if t.getOutlineLevel() is not None else 1,
            "milestone": bool(t.getMilestone()),
            "summary": bool(t.getSummary()),
            "start": d(t.getStart()),
            "finish": d(t.getFinish()),
        })

    proj_name = ""
    try:
        proj_name = str(pf.getProjectProperties().getName() or "")
    except Exception:
        pass
    with open(out_path, "w") as f:
        json.dump({"name": proj_name, "tasks": tasks}, f)


if __name__ == "__main__":
    main()
