#!/bin/bash
# MFSim — oturum başlangıcı: bağımlılıkları kur.
#
# NEDEN VAR: `node_modules/` git'e dahil değil ve uzak oturum konteyneri depoyu
# her seferinde temiz klonluyor. Kurulum yapılmazsa `npm test` çalışmaz —
# `npx jest` paketi ağdan indirmeye kalkar, ÖLÇÜLDÜ: 3 dk 52 sn harcayıp
# "jest-environment-jsdom bulunamadı" ile düşer. Yani kayıp sessiz DEĞİL ama
# geç: dört dakika sonra hiçbir test koşmamış olur.
#
# `npm ci` DEĞİL `npm install`: konteyner durumu hook bittikten sonra
# önbelleğe alınıyor, `install` mevcut ağacı olduğu gibi kabul edip hızlı
# çıkıyor. `ci` her seferinde node_modules'ü siler ve 7 dakikayı geri getirir.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Yalnız uzak (claude.ai) oturumlarında: yerel makinede kurulum zaten kalıcı.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

npm install --no-audit --no-fund

# E2E Chromium'u BİLEREK kurulmuyor: ~1,5 dk ekliyor ve E2E oturumların
# küçük bir kısmında gerekiyor. Gerektiğinde: npx playwright install chromium
