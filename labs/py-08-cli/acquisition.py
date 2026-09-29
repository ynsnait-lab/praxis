"""Résumé de fichiers de mesures en ligne de commande (lab py-08).

Usage : python acquisition.py fichiers... [--capteur NOM] [--sortie CHEMIN] [-v]
"""
import logging

log = logging.getLogger("acquisition")


def main(argv=None):
    """Point d'entrée : renvoie 0 (succès), 1 (aucune mesure) ou 2 (fichier introuvable)."""
    raise NotImplementedError("à écrire")


if __name__ == "__main__":
    raise SystemExit(main())
