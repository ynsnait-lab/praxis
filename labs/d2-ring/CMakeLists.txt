cmake_minimum_required(VERSION 3.20)
project(defi_d2 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
option(PRAXIS_SANITIZE "AddressSanitizer + UndefinedBehaviorSanitizer" OFF)
find_package(Threads REQUIRED)

# verif.cpp instancie la file : ring.hpp est ainsi compilé avec tous les avertissements.
add_library(lab verif.cpp)
target_include_directories(lab PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_options(lab PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)

add_executable(tests test_ring.cpp)
target_link_libraries(tests PRIVATE lab Threads::Threads)
target_include_directories(tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../_commun/cpp)

if(PRAXIS_SANITIZE)
  foreach(cible lab tests)
    target_compile_options(${cible} PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer -fno-sanitize-recover=all)
    target_link_options(${cible} PRIVATE -fsanitize=address,undefined)
  endforeach()
endif()

enable_testing()
add_test(NAME tests COMMAND tests)
set_tests_properties(tests PROPERTIES TIMEOUT 60)
