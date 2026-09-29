// verif.cpp : instancie la file pour que le compilateur vérifie ring.hpp avec tous les avertissements.
#include <cstdint>
#include <string>

#include "ring.hpp"

template class Ring<int, 8>;
template class Ring<std::uint8_t, 64>;
template class Ring<std::string, 4>;
