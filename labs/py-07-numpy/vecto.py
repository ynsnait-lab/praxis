"""Traitements de signal écrits avec des boucles (lab py-07). À vectoriser."""
import numpy as np


def volts(brut, vref=3.3, bits=12):
    pleine_echelle = 2**bits - 1
    return np.array([b * vref / pleine_echelle for b in brut])


def rejeter_aberrants(x, k=3.0):
    x = np.asarray(x, dtype=float)
    moyenne, ecart = x.mean(), x.std()
    gardees = []
    for v in x:
        if abs(v - moyenne) <= k * ecart:
            gardees.append(v)
    return np.array(gardees)


def moyenne_glissante(x, n):
    x = np.asarray(x, dtype=float)
    return np.array([x[i:i + n].mean() for i in range(len(x) - n + 1)])


def centrer_colonnes(a):
    a = np.asarray(a, dtype=float)
    resultat = np.empty_like(a)
    for j in range(a.shape[1]):
        resultat[:, j] = a[:, j] - a[:, j].mean()
    return resultat


def eclaircir(image, delta):
    return (image + delta).astype(np.uint8)          # piège : uint8 reboucle au-delà de 255


def compter_fronts(x, seuil):
    n = 0
    for i in range(1, len(x)):
        if x[i - 1] < seuil <= x[i]:
            n += 1
    return n
