"""Traitements de signal vectorisés (lab py-07) : solution, sans aucune boucle Python."""
import numpy as np


def volts(brut, vref=3.3, bits=12):
    return np.asarray(brut, dtype=float) * vref / (2**bits - 1)


def rejeter_aberrants(x, k=3.0):
    x = np.asarray(x, dtype=float)
    return x[np.abs(x - x.mean()) <= k * x.std()]


def moyenne_glissante(x, n):
    x = np.asarray(x, dtype=float)
    c = np.cumsum(np.insert(x, 0, 0.0))
    return (c[n:] - c[:-n]) / n


def centrer_colonnes(a):
    a = np.asarray(a, dtype=float)
    return a - a.mean(axis=0)                    # broadcasting (n, m) - (m,)


def eclaircir(image, delta):
    return np.clip(image.astype(np.int16) + delta, 0, 255).astype(np.uint8)


def compter_fronts(x, seuil):
    x = np.asarray(x)
    return int(np.count_nonzero((x[:-1] < seuil) & (x[1:] >= seuil)))
