# Indices d4

## Les défauts de la version naïve
Elle calcule l'erreur en 32 bits (débordement avec des valeurs extrêmes), n'applique ni la borne de l'intégrale ni celle de la sortie, dérive dès le premier appel, et n'a pas d'anti-emballement.

## Calculer en 64 bits
`const std::int64_t e = static_cast<std::int64_t>(consigne) - mesure;` : la conversion **avant** la soustraction. Les gains sont déjà des `std::int64_t`, donc les produits aussi.

## Borner proprement
`std::clamp(valeur, mini, maxi)` (en-tête `<algorithm>`). Pour la sortie, borne **avant** de reconvertir en `std::int32_t`.

## L'anti-emballement
Une petite lambda `brut(integrale)` calcule `(kp·e + ki·integrale + kd·de) >> 12`. Appelle-la d'abord avec l'intégrale actuelle : si le résultat sature déjà dans le sens de l'erreur, n'accumule pas ; sinon accumule (et borne). Puis calcule la sortie définitive et borne-la.

## Pourquoi ça compte
Sans anti-emballement, pendant une longue saturation (chauffe au maximum d'une enceinte froide), l'intégrale grimpe sans fin ; quand la consigne est atteinte, il faut des milliers de pas pour la « vider », et la température dépasse largement la consigne.
