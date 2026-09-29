"""Lecture/écriture YAML lisible pour le contenu Praxis (blocs littéraux pour le multi-ligne)."""
import yaml


class _Dumper(yaml.SafeDumper):
    pass


def _str_representer(dumper, data):
    if "\n" in data:
        # Bloc littéral : on retire les espaces en fin de ligne (sinon PyYAML repasse en guillemets).
        cleaned = "\n".join(line.rstrip() for line in data.split("\n"))
        return dumper.represent_scalar("tag:yaml.org,2002:str", cleaned, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)


_Dumper.add_representer(str, _str_representer)


def dump(obj, path):
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(obj, f, Dumper=_Dumper, allow_unicode=True, sort_keys=False, width=10_000, indent=2)


def load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)
