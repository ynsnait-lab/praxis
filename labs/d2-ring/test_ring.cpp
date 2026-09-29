// Tests du défi d2. Ne les modifie pas : écris ring.hpp.
#include <atomic>
#include <chrono>
#include <cstdlib>
#include <new>
#include <string>
#include <thread>
#include <type_traits>

#include "praxis_test.hpp"
#include "ring.hpp"

// Compteur d'allocations : remplace l'operator new global pendant les tests.
static std::atomic<long> allocations{0};
void* operator new(std::size_t n) {
    allocations.fetch_add(1, std::memory_order_relaxed);
    if (void* p = std::malloc(n ? n : 1)) return p;
    throw std::bad_alloc();
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }

TEST("file neuve : vide") {
    Ring<int, 8> r;
    CHECK(r.empty());
    CHECK(!r.full());
    CHECK_EQ(r.size(), std::size_t{0});
    int v = 0;
    CHECK(!r.pop(v));
}

TEST("premier entré, premier sorti") {
    Ring<int, 8> r;
    CHECK(r.push(1));
    CHECK(r.push(2));
    CHECK(r.push(3));
    CHECK_EQ(r.size(), std::size_t{3});
    int v = 0;
    CHECK(r.pop(v));
    CHECK_EQ(v, 1);
    CHECK(r.pop(v));
    CHECK_EQ(v, 2);
    CHECK_EQ(r.size(), std::size_t{1});
}

TEST("capacité exacte : N éléments") {
    Ring<int, 4> r;
    for (int i = 0; i < 4; ++i) CHECK(r.push(i));
    CHECK(r.full());
    CHECK(!r.push(99));
    CHECK_EQ(r.size(), std::size_t{4});
}

TEST("bouclage des indices sur de nombreux tours") {
    Ring<int, 4> r;
    int attendu = 0;
    for (int i = 0; i < 1000; ++i) {
        CHECK(r.push(i));
        if (i % 3 == 2) {
            int v = -1;
            while (r.pop(v)) CHECK_EQ(v, attendu++);
        }
    }
    int v = -1;
    while (r.pop(v)) CHECK_EQ(v, attendu++);
    CHECK_EQ(attendu, 1000);
}

TEST("type non trivial : std::string") {
    Ring<std::string, 4> r;
    CHECK(r.push("thermocouple"));
    CHECK(r.push("pt100"));
    std::string s;
    CHECK(r.pop(s));
    CHECK_EQ(s, std::string("thermocouple"));
}

TEST("ni copiable ni déplaçable") {
    CHECK(!(std::is_copy_constructible_v<Ring<int, 8>>));
    CHECK(!(std::is_copy_assignable_v<Ring<int, 8>>));
    CHECK(!(std::is_move_constructible_v<Ring<int, 8>>));
}

TEST("aucune allocation dynamique") {
    Ring<int, 1024> r;
    const long avant = allocations.load();
    for (int tour = 0; tour < 50; ++tour) {
        for (int i = 0; i < 1024; ++i) r.push(i);
        int v = 0;
        while (r.pop(v)) {
        }
    }
    CHECK_EQ(allocations.load() - avant, 0L);
}

TEST("un producteur et un consommateur en parallèle") {
    static Ring<int, 64> r;
    constexpr int total = 200000;
    static std::atomic<bool> abandon{false};
    const auto limite = std::chrono::steady_clock::now() + std::chrono::seconds(10);
    std::thread producteur([] {
        for (int i = 0; i < total && !abandon; ++i)
            while (!r.push(i) && !abandon) std::this_thread::yield();
    });
    int attendu = 0;
    bool ordre = true;
    while (attendu < total && std::chrono::steady_clock::now() < limite) {
        int v = 0;
        if (r.pop(v)) {
            ordre = ordre && (v == attendu);
            ++attendu;
        } else {
            std::this_thread::yield();
        }
    }
    abandon = true;                        // débloque le producteur si la file ne marche pas
    producteur.join();
    CHECK_EQ(attendu, total);
    CHECK(ordre);
    CHECK(r.empty());
}
