#!/bin/sh
# Вырезает восемь иконок участников из одобренных листов прототипа (K42, дизайн M1.2 E5) в
# content/icons/<имя>.webp. Запускается вручную, один раз; результат лежит в репозитории.
# В gate не входит. Нужен ImageMagick 7 (`magick`); в проект он не добавляется.
#
#   sh scripts/cut-icons.sh          # перезаписать иконки
#
# Вырезка 310×275 из листа 1024×434 по тем же координатам, что в prototype/index.html.
# Мягкие края «запечены» в прозрачность: по FEATHER px с каждой стороны картинка линейно
# становится прозрачной (в прототипе то же делали градиенты «feather» поверх картинки: 10 из 150
# по ширине). Поэтому край не виден на бумаге сцены, даже если её цвет на единицу отличается от
# фона листа. WebP вместо JPEG: на 40% легче при том же виде и умеет прозрачность (K47).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SHEETS="$ROOT/prototype/assets"
OUT="$ROOT/content/icons"
FEATHER=${ICON_FEATHER:-24}
W=310
H=275
QUALITY=${ICON_QUALITY:-82}

command -v magick >/dev/null || {
  echo 'cut-icons: нужен ImageMagick 7 (magick)' >&2
  exit 1
}
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Маска непрозрачности: 1 внутри, линейно к 0 на краях.
magick -size "${W}x${H}" xc:black -fx \
  "min(min(i,w-1-i),$FEATHER)/$FEATHER * min(min(j,h-1-j),$FEATHER)/$FEATHER" \
  "$TMP/mask.png"

cut() { # имя лист x y
  magick "$SHEETS/sheet-$2.jpg" -crop "${W}x${H}+$3+$4" +repage \
    "$TMP/mask.png" -alpha off -compose CopyOpacity -composite \
    -strip -quality "$QUALITY" "$OUT/$1.webp"
  echo "content/icons/$1.webp $(wc -c <"$OUT/$1.webp" | tr -d ' ') bytes"
}

cut attacker a 60 78
cut server a 370 78
cut db a 677 78
cut user b 67 78
cut mail b 380 64
cut router c 41 82
cut browser c 350 78
cut bank c 675 78
