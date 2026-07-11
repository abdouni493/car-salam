# CAR SALAM — Design System (Source of Truth)

> Identité "Noir & Rouge Sang" dérivée du logo CAR SALAM
> (fond noir · lettrage chrome · accent cramoisi profond · bouclier CS).
>
> Ce fichier est la **source de vérité** du site public.
> Implémentation : `src/index.css` (bloc `@theme`).
> Remplace `design-system/auto_location/MASTER.md` (ancienne palette or & clair).

---

## 1. Direction artistique

| | |
|---|---|
| **Style** | Dark Mode (OLED) — premium automobile |
| **Pattern** | Hero immersif + révélation au scroll |
| **Mood** | Nocturne, performance, luxe discret, tension chrome/rouge |
| **Ton** | Contraste fort, aplats noirs profonds, rouge utilisé avec parcimonie |

**Principe directeur : le rouge est rare.** Sur le logo, le rouge ne couvre qu'une
fraction de la surface — le reste est noir et chrome. Le site respecte ce ratio :
le rouge signale **l'action et l'état actif**, jamais la décoration de fond.
Si tout est rouge, plus rien n'est rouge.

---

## 2. Couleurs

### Surfaces (échelle de profondeur — noms `vel-*` historiques conservés)

| Token | Hex | Usage |
|---|---|---|
| `--color-vel-void` | `#08080A` | Fond de page (noir quasi-OLED, pas #000 pur → évite le smearing) |
| `--color-vel-abyss` | `#0E0E11` | Bandes, placeholders d'image |
| `--color-vel-deep` | `#121216` | Creux, pistes de champs |
| `--color-vel-surface` | `#151519` | Cartes |
| `--color-vel-elevated` | `#1C1C22` | Cartes survolées, modales, champs |

### Rouge (accent) — l'échelle

| Token | Hex | Contraste /void | Usage |
|---|---|---|---|
| `--color-vel-cta` | `#C8102E` | 3.4:1 | **Remplissages** : boutons, badges, barres. Texte blanc dessus = 5.9:1 ✓ |
| `--color-vel-cta-deep` | `#8A0A1C` | — | Fin de dégradé, ombres, états pressés |
| `--color-vel-cta-bright` | `#FF4D52` | 6.1:1 ✓ | **Texte** rouge en petit corps sur fond noir (AA) |

> ⚠️ Règle d'accessibilité : `--color-vel-cta` (#C8102E) est un **rouge de
> remplissage**. À 3.4:1 il passe pour les grands titres et les composants d'UI
> (seuil 3:1) mais **échoue en texte de petit corps**. Pour du texte rouge lisible,
> utiliser `--color-vel-cta-bright`.

### Chrome (le lettrage "CAR" du logo)

| Token | Hex | Usage |
|---|---|---|
| `--color-vel-chrome` | `#E9EBEE` | Reflet haut du dégradé chrome |
| `--color-vel-silver` | `#9AA0AA` | Reflet bas, filets métalliques |

### Texte (sur fond noir)

| Token | Hex | Contraste /void | Usage |
|---|---|---|---|
| `--color-vel-ink` | `#F5F6F7` | 18.5:1 ✓ | Titres, texte principal |
| `--color-vel-slate` | `#C7CBD2` | 12.0:1 ✓ | Texte secondaire |
| `--color-vel-muted` | `#9BA1AB` | 8.3:1 ✓ | Texte tertiaire, labels |
| `--color-vel-dim` | `#7A808B` | 5.1:1 ✓ | Méta, copyright, désactivé |

Les 4 niveaux passent AA en corps de texte — pas de gris-sur-gris.

### Bordures

| Token | Valeur | Usage |
|---|---|---|
| `--color-vel-border` | `rgba(255,255,255,0.09)` | Séparateurs, contours de carte |
| `--color-vel-border-strong` | `rgba(255,255,255,0.16)` | Contours de champs, focus au repos |
| `--color-vel-border-red` | `rgba(200,16,46,0.35)` | Contours accentués, état actif |

---

## 3. Typographie

- **Display** : `Space Grotesk` — titres, nav, boutons, chiffres.
  Géométrique et large : rime avec le lettrage étiré du logo.
- **Corps** : `DM Sans` — paragraphes, formulaires.
- **Arabe** : `Noto Sans Arabic` (RTL).

Échelle : 12 · 14 · 16 · 18 · 24 · 32 · 48 · 64
Corps mini **16px** en mobile (évite l'auto-zoom iOS).
Titres : `font-weight 700`, `letter-spacing -0.02em`.
Sur-titres / labels : `uppercase`, `letter-spacing 0.2em`, `font-weight 700`.

---

## 4. Effets

| Effet | Valeur |
|---|---|
| Lueur rouge | `box-shadow: 0 0 24px rgba(200,16,46,0.25)` — **uniquement** sur éléments actifs/CTA |
| Élévation carte | `0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.5)` |
| Filet chrome | `linear-gradient(180deg, #E9EBEE, #9AA0AA)` en `background-clip: text` |
| Verre | `background: rgba(255,255,255,0.03)` + `backdrop-filter: blur(12px)` + bordure |
| Rayon | `sm 8px · md 12px · lg 16px · xl 24px · pill 999px` |

**Interdits** : néon multicolore, rouge en fond plein de section, ombres colorées
sur du texte de corps, dégradés arc-en-ciel.

---

## 5. Mouvement

Rythme global — tokens partagés par toutes les animations :

| Token | Valeur |
|---|---|
| Entrée | `280ms` · `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out) |
| Sortie | `180ms` · `ease-in` (≈65 % de l'entrée) |
| Micro-interaction | `150–200ms` |
| Ressort (spring) | `stiffness 260 · damping 26` |
| Stagger de liste | `50ms` par item, plafonné à 8 items |

**Règles**
- Animer **uniquement** `transform` et `opacity` (jamais `width`/`height`/`top`).
- Toute animation exprime une cause → effet. Pas de mouvement décoratif.
- Presser un élément cliquable : `scale(0.97)`. Survol de carte : `translateY(-4px)`.
- `prefers-reduced-motion: reduce` → transitions coupées, contenu immédiatement lisible.
- Les animations ne bloquent jamais la saisie.

---

## 6. Logo

Le logo est un **wordmark large** (ratio ≈ 3:2), pas une icône carrée.

- **Navbar** : `height: 44px; width: auto; object-fit: contain; max-width: 190px`.
  Jamais `object-cover` dans un carré → décapite le lettrage.
- Fond du logo = noir → il se fond nativement dans la navbar noire. Pas de carte
  blanche derrière, pas de `border-radius` qui rogne les angles.
- Repli sans logo : monogramme **CS** chrome sur bouclier rouge.
- Stocké dans le bucket Supabase `website`, champ `website_settings.logo`.

---

## 7. Checklist de livraison

- [ ] Contraste texte ≥ 4.5:1 sur `#08080A` (les 4 tokens de texte sont conformes)
- [ ] Rouge de remplissage jamais utilisé en texte de petit corps
- [ ] Zones tactiles ≥ 44×44px
- [ ] `focus-visible` net (anneau rouge 2px) sur tous les interactifs
- [ ] Aucun emoji en guise d'icône → `lucide-react`
- [ ] `prefers-reduced-motion` respecté
- [ ] Testé à 375 / 768 / 1024 / 1440 px
- [ ] Pas de scroll horizontal en mobile
