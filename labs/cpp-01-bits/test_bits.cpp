// Tests du lab cpp-01. Ne les modifie pas : complète bits.cpp.
#include <cstdint>

#include "bits.hpp"
#include "praxis_test.hpp"

TEST("combiner assemble deux octets") {
    CHECK_EQ(combiner(0x12, 0x34), 0x1234);
    CHECK_EQ(combiner(0xFF, 0x00), 0xFF00);
    CHECK_EQ(combiner(0x00, 0xFF), 0x00FF);
}

TEST("extraire un champ") {
    CHECK_EQ(extraire(0xA00u, 8, 4), 0xAu);
    CHECK_EQ(extraire(0b1011'0100u, 2, 3), 0b101u);
    CHECK_EQ(extraire(0x8000'0000u, 31, 1), 1u);
}

TEST("extraire le registre entier (largeur 32)") {
    CHECK_EQ(extraire(0xDEAD'BEEFu, 0, 32), 0xDEAD'BEEFu);
}

TEST("inserer un champ sans toucher au reste") {
    CHECK_EQ(inserer(0x0000'0000u, 8, 4, 0b1010u), 0x0000'0A00u);
    CHECK_EQ(inserer(0xFFFF'FFFFu, 8, 4, 0u), 0xFFFF'F0FFu);
    CHECK_EQ(inserer(0x1234'5678u, 4, 8, 0x1FFu), 0x1234'5FF8u);   // valeur tronquée à 8 bits
    CHECK_EQ(inserer(0u, 0, 32, 0xCAFE'F00Du), 0xCAFE'F00Du);
}

TEST("saturer_u8") {
    CHECK_EQ(saturer_u8(-5), 0);
    CHECK_EQ(saturer_u8(0), 0);
    CHECK_EQ(saturer_u8(128), 128);
    CHECK_EQ(saturer_u8(255), 255);
    CHECK_EQ(saturer_u8(300), 255);
    CHECK_EQ(saturer_u8(INT32_MAX), 255);
}

TEST("mul_q8_8 : cas courants") {
    CHECK_EQ(mul_q8_8(384, 5184), 7776);          // 1.5 × 20.25 = 30.375
    CHECK_EQ(mul_q8_8(256, 256), 256);            // 1 × 1 = 1
    CHECK_EQ(mul_q8_8(-384, 512), -768);          // -1.5 × 2 = -3
    CHECK_EQ(mul_q8_8(0, 32767), 0);
}

TEST("mul_q8_8 : arrondi au plus proche") {
    CHECK_EQ(mul_q8_8(1, 128), 1);                // 0.5 unité : arrondie vers le haut
    CHECK_EQ(mul_q8_8(1, 127), 0);
}

TEST("mul_q8_8 : saturation au lieu de rebouclage") {
    CHECK_EQ(mul_q8_8(25600, 512), 32767);        // 100 × 2 dépasse ~128
    CHECK_EQ(mul_q8_8(-25600, 512), -32768);
    CHECK_EQ(mul_q8_8(32767, 32767), 32767);
}

TEST("q12_4_vers_milli") {
    CHECK_EQ(q12_4_vers_milli(0x0191), 25062);    // 25,0625 °C
    CHECK_EQ(q12_4_vers_milli(-88), -5500);       // -5,5 °C
    CHECK_EQ(q12_4_vers_milli(32767), 2047937);
    CHECK_EQ(q12_4_vers_milli(-32768), -2048000);
}
