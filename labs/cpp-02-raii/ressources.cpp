// ressources.cpp (lab cpp-02)
#include "ressources.hpp"

std::vector<Port> ouvrir_ports(int n) {
    std::vector<Port> ports;
    for (int i = 0; i < n; ++i) ports.emplace_back();
    return ports;
}
