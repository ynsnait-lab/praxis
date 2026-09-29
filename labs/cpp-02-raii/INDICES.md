# Indices cpp-02

## Le constructeur
`materiel::ouvrir_port()` renvoie `-1` quand il n'y a plus de port libre. Le constructeur doit alors lever `std::runtime_error` : un objet `Port` qui existe possède toujours un port valide (ou rien, s'il a été déplacé).

## Le destructeur
Il ferme le port **seulement si** l'objet en possède encore un. Convention : `id_ == 0` veut dire « ne possède rien ».

## Le déplacement
Le constructeur de déplacement prend le numéro de la source et met la source à 0 : `id_(std::exchange(autre.id_, 0))`. L'affectation de déplacement doit **d'abord fermer** le port qu'elle possède déjà, puis prendre celui de la source. Pense au cas `p = std::move(p);`.

## La section critique
Le constructeur mémorise `materiel::irq_actives` **avant** de les désactiver ; le destructeur remet la valeur mémorisée, au lieu de tout réactiver. Une section imbriquée dans une autre ne doit donc rien réactiver en sortant.
