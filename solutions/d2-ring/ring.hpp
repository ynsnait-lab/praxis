// ring.hpp : solution du défi d2. File SPSC (un producteur, un consommateur), sans allocation.
#pragma once

#include <array>
#include <atomic>
#include <cstddef>

template <typename T, std::size_t N>
class Ring {
    static_assert(N > 0 && (N & (N - 1)) == 0, "N doit être une puissance de 2");

public:
    Ring() = default;
    Ring(const Ring&) = delete;                 // une file partagée avec une ISR ne se copie pas…
    Ring& operator=(const Ring&) = delete;      // …et, copie supprimée, ne se déplace pas non plus

    bool push(const T& v) {                     // appelée par le producteur seul
        const std::size_t t = tete_.load(std::memory_order_relaxed);
        if (t - queue_.load(std::memory_order_acquire) == N) return false;    // pleine
        donnees_[t & (N - 1)] = v;
        tete_.store(t + 1, std::memory_order_release);                        // publie l'élément
        return true;
    }

    bool pop(T& v) {                            // appelée par le consommateur seul
        const std::size_t q = queue_.load(std::memory_order_relaxed);
        if (q == tete_.load(std::memory_order_acquire)) return false;         // vide
        v = donnees_[q & (N - 1)];
        queue_.store(q + 1, std::memory_order_release);                       // libère la case
        return true;
    }

    std::size_t size() const {
        return tete_.load(std::memory_order_acquire) - queue_.load(std::memory_order_acquire);
    }
    bool empty() const { return size() == 0; }
    bool full() const { return size() == N; }

private:
    std::array<T, N> donnees_{};
    std::atomic<std::size_t> tete_{0};          // total poussé (ne fait qu'augmenter)
    std::atomic<std::size_t> queue_{0};         // total retiré
};
