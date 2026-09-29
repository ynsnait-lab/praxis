// ring.hpp : file circulaire à capacité fixe (défi d2). À écrire.
#pragma once

#include <array>
#include <atomic>
#include <cstddef>

template <typename T, std::size_t N>
class Ring {
public:
    bool push(const T& v) {
        (void)v;
        return false;  // à écrire
    }
    bool pop(T& v) {
        (void)v;
        return false;  // à écrire
    }
    std::size_t size() const { return 0; }
    bool empty() const { return true; }
    bool full() const { return false; }

private:
    std::array<T, N> donnees_{};
};
