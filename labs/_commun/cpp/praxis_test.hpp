// praxis_test.hpp : un mini-cadre de tests pour les labs C++ (un seul en-tête, aucune dépendance).
//
//   #include "praxis_test.hpp"
//   TEST("combiner assemble deux octets") {
//       CHECK_EQ(combiner(0x12, 0x34), 0x1234);
//   }
//
// Chaque TEST est une fonction enregistrée automatiquement ; main() (fourni ici) les exécute toutes,
// affiche les échecs avec les valeurs comparées, et renvoie 1 s'il y en a (ce que lit CTest).
#pragma once

#include <cmath>
#include <cstdio>
#include <exception>
#include <functional>
#include <sstream>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

namespace praxis {

struct CasDeTest {
    const char* nom;
    void (*fonction)();
};

inline std::vector<CasDeTest>& registre() {
    static std::vector<CasDeTest> r;
    return r;
}

inline int& echecs_du_test() {
    static int n = 0;
    return n;
}

struct Enregistreur {
    Enregistreur(const char* nom, void (*f)()) { registre().push_back({nom, f}); }
};

template <typename T>
std::string montrer(const T& v) {
    if constexpr (std::is_same_v<T, bool>) {
        return v ? "true" : "false";
    } else if constexpr (std::is_same_v<T, char> || std::is_same_v<T, signed char> || std::is_same_v<T, unsigned char>) {
        return std::to_string(static_cast<int>(v));           // un uint8_t s'affiche comme un nombre
    } else if constexpr (std::is_enum_v<T>) {
        return "enum(" + std::to_string(static_cast<long long>(v)) + ")";
    } else if constexpr (requires(std::ostream& o, const T& x) { o << x; }) {
        std::ostringstream o;
        o.precision(10);
        o << v;
        return o.str();
    } else {
        return "(valeur non affichable)";
    }
}

inline void echec(const char* fichier, int ligne, const std::string& message) {
    const char* nom = fichier;
    for (const char* p = fichier; *p; ++p)
        if (*p == '/' || *p == '\\') nom = p + 1;
    std::printf("    ✗ %s:%d  %s\n", nom, ligne, message.c_str());
    ++echecs_du_test();
}

}  // namespace praxis

#define PRAXIS_CONCAT2(a, b) a##b
#define PRAXIS_CONCAT(a, b) PRAXIS_CONCAT2(a, b)

#define TEST(nom)                                                                              \
    static void PRAXIS_CONCAT(praxis_test_, __LINE__)();                                       \
    static const praxis::Enregistreur PRAXIS_CONCAT(praxis_reg_, __LINE__)(nom, &PRAXIS_CONCAT(praxis_test_, __LINE__)); \
    static void PRAXIS_CONCAT(praxis_test_, __LINE__)()

#define CHECK(expr)                                                                            \
    do {                                                                                       \
        if (!(expr)) praxis::echec(__FILE__, __LINE__, "CHECK(" #expr ") est faux");           \
    } while (0)

#define CHECK_EQ(a, b)                                                                         \
    do {                                                                                       \
        const auto praxis_va = (a);                                                            \
        const auto praxis_vb = (b);                                                            \
        if (!(praxis_va == praxis_vb))                                                         \
            praxis::echec(__FILE__, __LINE__, std::string(#a " == " #b " : obtenu ") +          \
                                                  praxis::montrer(praxis_va) + ", attendu " +  \
                                                  praxis::montrer(praxis_vb));                 \
    } while (0)

#define CHECK_NEAR(a, b, tol)                                                                  \
    do {                                                                                       \
        const double praxis_va = static_cast<double>(a);                                       \
        const double praxis_vb = static_cast<double>(b);                                       \
        if (!(std::fabs(praxis_va - praxis_vb) <= (tol)))                                      \
            praxis::echec(__FILE__, __LINE__, std::string(#a " ≈ " #b " : obtenu ") +           \
                                                  praxis::montrer(praxis_va) + ", attendu " +  \
                                                  praxis::montrer(praxis_vb));                 \
    } while (0)

#define CHECK_THROWS(expr)                                                                     \
    do {                                                                                       \
        bool praxis_leve = false;                                                              \
        try { (void)(expr); } catch (...) { praxis_leve = true; }                              \
        if (!praxis_leve) praxis::echec(__FILE__, __LINE__, "aucune exception levée par " #expr); \
    } while (0)

#ifndef PRAXIS_SANS_MAIN
int main() {
    int rates = 0;
    for (const auto& t : praxis::registre()) {
        praxis::echecs_du_test() = 0;
        try {
            t.fonction();
        } catch (const std::exception& e) {
            praxis::echec("?", 0, std::string("exception inattendue : ") + e.what());
        } catch (...) {
            praxis::echec("?", 0, "exception inattendue");
        }
        const bool ok = praxis::echecs_du_test() == 0;
        std::printf("%s %s\n", ok ? "  ✓" : "  ✗", t.nom);
        rates += !ok;
    }
    std::printf("%zu tests, %d en échec\n", praxis::registre().size(), rates);
    return rates ? 1 : 0;
}
#endif
