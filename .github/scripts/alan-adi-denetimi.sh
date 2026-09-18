#!/usr/bin/env bash
# =============================================================================
# SEKİZ — ALAN ADI NÖBETÇİSİ
#
# NEDEN VAR
# `sekizkyal.com` ürünün ön kapısı: 720 öğrencinin ve velinin eline BASILI
# fişlerle giden adres. Tek bir yıllık ödemeye bağlı ve kaybı geri
# alınamaz — süresi dolan alan adını bir süre sonra BAŞKASI alabilir, o
# gün bütün fişler yabancı bir siteye gider.
#
# Bugün iki koruma da yerinde: Spaceship'te otomatik yenileme açık ve
# kayıtlı kart yenilemeden sonrasına kadar geçerli. Nöbetçinin sebebi bu
# değil — SESSİZCE BOZULABİLMELERİ. Kart son kullanma tarihinden önce de
# değişir (kayıp, banka yenilemesi); yenileme e-postası spam'e düşer; DNS
# kaydı değişir; `CNAME` bir yayında düşer. Hiçbirinde uyarı gelmez;
# kusur "giremiyoruz" diye haber gelince öğrenilir.
#
# NE ÖLÇÜYOR — İKİSİ DE GEÇMELİ
#   A. Alan adının bitişine kaç gün kaldı (eşiğin altındaysa kusur)
#   B. Adres gerçekten SEKİZ'i sunuyor mu, ve eski adres hâlâ yönlendiriyor mu
#
# NEDEN AYRI BİR BETİK, İŞ AKIŞININ İÇİNDE DEĞİL
# GitHub Actions yerelde çalıştırılamaz. Mantık `yml` içine gömülseydi
# ısırdığı hiç gösterilemezdi — bu depoda hiçbir ölçüm kanıtsız kabul
# edilmiyor. Betik olarak yazılınca eşik ve alan adı değiştirilerek
# yerelde sınanabiliyor (dosyanın sonundaki nota bakın).
#
# DÜRÜST SINIRLAR
#   - GitHub, 60 gün hareketsiz depolarda zamanlanmış işleri durduruyor.
#     Yaz tatilinde depo sessizleşirse bu nöbetçi de susar. Takvim
#     hatırlatmasının YERİNE geçmez, yanına gelir.
#   - Otomatik yenilemenin açık olup olmadığını göremez; Spaceship bunu
#     dışarıya açmıyor. Ölçtüğü şey sonuç: süre azalıyor mu.
#   - Kartın geçerliliğini de göremez. Kart ölürse bunu ancak süre
#     eşiğin altına indiğinde anlarız — o yüzden eşik cömert (45 gün).
# =============================================================================
set -uo pipefail

# Bitişe bu kadar günden az kaldıysa kusur. Haftalık koşuda bitişten önce
# ~6 uyarı demek: fark edilmeye yetecek kadar çok, görmezden gelinmeye
# alışılmayacak kadar az.
ESIK_GUN=${ESIK_GUN:-45}

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

kusur=0
hata() { echo "::error::$*"; kusur=$((kusur + 1)); }
ok()   { echo "  ✓ $*"; }

# -----------------------------------------------------------------------------
# ALAN ADI TEK KAYNAKTAN: kökteki `CNAME`
#
# `uyanik-tut.yml` adresi `app/.env`'den okuyor ve gerekçesi orada yazılı:
# "İkinci bir kopya tutulsaydı biri değişince öbürü sessizce eskirdi."
# Aynı kural burada da geçerli. GitHub Pages özel alan adını ZATEN yalnız
# bu dosyadan okuyor; nöbetçinin ayrı bir kopyaya bakması, bir gün
# gerçekte izlenmeyen bir adresi izliyormuş gibi görünmesi demekti.
# -----------------------------------------------------------------------------
if [ -z "${ALAN_ADI:-}" ]; then
  if [ ! -f "$KOK/CNAME" ]; then
    hata "Kökte CNAME dosyası yok — alan adı öğrenilemedi. Özel alan adı düşmüş olabilir."
    exit 1
  fi
  ALAN_ADI=$(tr -d '[:space:]' < "$KOK/CNAME")
fi

if [ -z "$ALAN_ADI" ]; then
  hata "CNAME dosyası BOŞ — alan adı öğrenilemedi."
  exit 1
fi

echo "Nöbetçi: $ALAN_ADI (eşik: $ESIK_GUN gün)"

# -----------------------------------------------------------------------------
# A. SÜRE — RDAP
#
# İKİ KAYNAK, VE "BAKAMADIM" DA BİR KUSURDUR. Tek kaynak bir gün kapansa
# nöbetçi sessizce nöbet tutmayı bırakırdı ve bunu kimse fark etmezdi.
# Önce kayıt kuruluşunun kendi ucu, olmazsa rdap.org. İkisi de yanıt
# vermezse iş BAŞARISIZ olur ve mesaj ne anlama geldiğini söyler:
# "süre öğrenilemedi" ≠ "süre yeterli".
# -----------------------------------------------------------------------------
echo
echo "A. Bitiş tarihi"

UZANTI="${ALAN_ADI##*.}"
BITIS=''
for kaynak in \
  "https://rdap.verisign.com/${UZANTI}/v1/domain/${ALAN_ADI}" \
  "https://rdap.org/domain/${ALAN_ADI}"
do
  YANIT=$(curl -sSL -m 30 "$kaynak" 2>/dev/null) || continue
  BITIS=$(printf '%s' "$YANIT" | python3 -c "
import json, sys
try:
    j = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for e in j.get('events', []):
    if e.get('eventAction') == 'expiration':
        print(e.get('eventDate', ''))
        break
" 2>/dev/null)
  [ -n "$BITIS" ] && { echo "  kaynak: $kaynak"; break; }
done

if [ -z "$BITIS" ]; then
  hata "Alan adının bitiş tarihi ÖĞRENİLEMEDİ ($ALAN_ADI). Alan adı bitmiş olmayabilir; iki RDAP kaynağı da yanıt vermedi. Spaceship panelinden ELLE bakın."
else
  KALAN=$(python3 -c "
import datetime, sys
t = datetime.datetime.fromisoformat('$BITIS'.replace('Z', '+00:00'))
simdi = datetime.datetime.now(datetime.timezone.utc)
print((t - simdi).days)
" 2>/dev/null)

  if [ -z "$KALAN" ]; then
    hata "Bitiş tarihi okundu ama çözümlenemedi: '$BITIS'"
  else
    # Tarih TR saatiyle yazılıyor: öğretmenin Spaceship panelinde gördüğü
    # gün bu. UTC yazsaydık panel 18 Eylül derken e-posta 17 Eylül der ve
    # "hangisi doğru" diye bakmak gerekirdi.
    TR=$(python3 -c "
import datetime
t = datetime.datetime.fromisoformat('$BITIS'.replace('Z', '+00:00'))
print((t + datetime.timedelta(hours=3)).strftime('%d.%m.%Y'))
")
    if [ "$KALAN" -lt "$ESIK_GUN" ]; then
      hata "ALAN ADI $KALAN GÜN SONRA BİTİYOR ($ALAN_ADI, $TR). Spaceship'te otomatik yenileme açık mı ve kayıtlı kart hâlâ geçerli mi, kontrol edin. Süre dolarsa adres bir süre sonra başkası tarafından alınabilir ve basılı fişlerdeki adres oraya gider."
    else
      ok "bitişe $KALAN gün var ($TR)"
    fi
  fi
fi

# -----------------------------------------------------------------------------
# B. ADRES GERÇEKTEN ÇALIŞIYOR MU
#
# İMZA OLARAK `<title>` KULLANILMIYOR ve sebebi ölçülmüş bir ders.
# Başlık `app/index.html`'de duruyor; depoda değişip site henüz
# yayınlanmamışken nöbetçi yanlış alarm verirdi. `uyanik-tut.yml`'nin en
# pahalı dersi tam buydu: "üç günde bir yanlış alarm, ve öğretmen alarma
# güvenmeyi bırakırdı." `manifest.webmanifest` hem sabit hem ASCII.
#
# AĞ TİTREMESİ ALARM OLMASIN: her denetim üç kez, artan beklemeyle
# deneniyor. Tek bir kesinti kusur sayılmamalı; kalıcı olan sayılmalı.
# -----------------------------------------------------------------------------
echo
echo "B. Adres"

# yokla <ad> <url> <beklenen_http> <gövdede_aranan|->
yokla() {
  local ad="$1" url="$2" beklenen="$3" aranan="$4"
  local bekle=2 kod govde

  for deneme in 1 2 3; do
    govde=$(curl -sS -m 30 -w '\n%{http_code}' "$url" 2>/dev/null) || govde=''
    kod=$(printf '%s' "$govde" | tail -n1)
    govde=$(printf '%s' "$govde" | sed '$d')

    if [ "$kod" = "$beklenen" ]; then
      if [ "$aranan" = '-' ] || printf '%s' "$govde" | grep -q "$aranan"; then
        ok "$ad (HTTP $kod)"
        return 0
      fi
      hata "$ad: HTTP $kod doğru ama sayfa SEKİZ değil ('$aranan' bulunamadı). Alan adı başka bir yere bağlanmış olabilir."
      return 1
    fi

    [ "$deneme" -lt 3 ] && { echo "  ($ad: HTTP ${kod:-yanıt yok}, $deneme. deneme — $bekle sn sonra tekrar)"; sleep "$bekle"; bekle=$((bekle * 2)); }
  done

  hata "$ad: üç denemede de başarısız (son HTTP ${kod:-yanıt yok}, $url). DNS, CNAME dosyası ya da GitHub Pages ayarı bozulmuş olabilir."
  return 1
}

# Uygulamanın kendisi. 200 dönmeli VE SEKİZ olmalı.
yokla "site açılıyor" "https://${ALAN_ADI}/yeni/" 200 'manifest.webmanifest'

# ESKİ ADRES — KÂĞIDA BASILMIŞ BİR SÖZ.
# Dağıtılmış fişlerde `buketmathlab.github.io/yeni/` yazıyor ve GitHub onu
# yeni adrese 301'liyor. Bu yönlendirme bir gün kalkarsa o kâğıtların
# hepsi ölür; ölçülmezse kimse fark etmez.
yokla "eski adres yönlendiriyor" "https://buketmathlab.github.io/yeni/" 301 '-'

# -----------------------------------------------------------------------------
echo
if [ "$kusur" -eq 0 ]; then
  echo "ALAN ADI NÖBETİ: KUSUR YOK"
  exit 0
fi
echo "ALAN ADI NÖBETİ: $kusur KUSUR"
exit 1

# =============================================================================
# YERELDE SINAMAK İÇİN (ısırdığını görmek için):
#
#   ESIK_GUN=100000 .github/scripts/alan-adi-denetimi.sh   → süre kusuru
#   ALAN_ADI=example.com .github/scripts/alan-adi-denetimi.sh → adres kusuru
#   ALAN_ADI=bulunmayan-bir-ad-xyz.com …                   → "öğrenilemedi"
# =============================================================================
