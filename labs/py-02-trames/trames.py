"""Décodage de trames capteur et regroupement des mesures (lab py-02)."""


def decoder(trame: bytes) -> tuple[int, float]:
    """Renvoie (canal, température en °C). Lève ValueError si la trame est invalide."""
    raise NotImplementedError("à écrire")


def decoder_flux(trames: list[bytes]) -> tuple[list[tuple[int, float]], int]:
    """Décode toutes les trames valides ; renvoie (mesures, nombre de trames rejetées)."""
    raise NotImplementedError("à écrire")


def grouper(mesures: list[tuple[int, float]]) -> dict[int, list[float]]:
    """Températures par canal, dans l'ordre d'arrivée."""
    raise NotImplementedError("à écrire")


def canaux_muets(attendus: set[int], mesures: list[tuple[int, float]]) -> set[int]:
    """Canaux attendus qui n'apparaissent dans aucune mesure."""
    raise NotImplementedError("à écrire")


def top_erreurs(codes: list[str], n: int) -> list[tuple[str, int]]:
    """Les n codes les plus fréquents, avec leur nombre d'occurrences."""
    raise NotImplementedError("à écrire")
