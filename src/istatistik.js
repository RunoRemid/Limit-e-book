/* =============================================================
   istatistik.js — Deneme günlüğünden ölçüt türetme
   -------------------------------------------------------------
   Saf hesaplama katmanı: DOM bilmez, çizim yapmaz. Arayüz yalnızca
   buradan okur; böylece ölçütlerin tanımı tek yerde durur ve
   test edilebilir.

   KAYNAK: yerel deneme günlüğü (Limit.depo.denemeGunlugu()).
   Ağ olmadan da doludur; Supabase yalnızca cihazlar arası
   zenginleştirme içindir.

   ÖLÇÜT TANIMLARI — burası kritik
   Deneme hakkı SINIRSIZ olduğu için klasik "doğruluk %" anlamsızdır:
   yeterince deneyen herkes eninde sonunda %100'e ulaşır. Bu yüzden
   iki ayrı ölçüt kullanılır ve ikisi de AYNI paydaya sahiptir
   (denenen soru sayısı) — böylece karıştırılamazlar:

     İlk denemede doğru : ipucu/koç almadan, ilk seferde doğru
                          çözülen sorular  → gerçek hakimiyet
     Sonunda çözülen    : kaç deneme ve yardım sonrası olursa olsun
                          doğruya ulaşılan sorular  → azim

   Bir soru "ilk denemede" sayılabilmesi için kazanan denemenin
   hem deneme_no = 1 hem koc_yardimi = false olması gerekir.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit || (global.Limit = {});

  /* Panelin anlamlı sayı üretebilmesi için gereken en az deneme. */
  var YETERLI_VERI = 5;
  /* Bir konunun "güçlü/odak" olarak adlandırılabilmesi için en az
     kaç farklı soru denenmiş olmalı. Tek soruya bakıp "bu konuda
     zayıfsın" demek haksızlık olur. */
  var KONU_ESIGI = 3;

  /* ----------------------------------------------------------- */
  function yuzde(pay, payda) {
    return payda ? Math.round((pay / payda) * 100) : 0;
  }

  /**
   * Denemeleri soru bazında toplar.
   * @returns {Object} soruId → { denemeler, kazanan, konu, brans, zorluk }
   */
  function soruBazinda(gunluk) {
    var harita = {};

    gunluk.forEach(function (k) {
      if (!k || !k.soru_id) return;
      var s = harita[k.soru_id] || (harita[k.soru_id] = {
        soru_id: k.soru_id,
        konu: k.konu || '—',
        brans: k.brans || null,
        zorluk: k.zorluk || null,
        denemeler: [],
        kazanan: null,
        sonZaman: null
      });

      s.denemeler.push(k);
      if (!s.sonZaman || k.zaman > s.sonZaman) s.sonZaman = k.zaman;

      /* Kazanan = doğruya ulaşılan ilk deneme. Sonradan gelen
         kayıtlar (ör. tekrar çözme) kazananı değiştirmez. */
      if (k.dogru_mu === true && !s.kazanan) s.kazanan = k;
    });

    return harita;
  }

  /** Bir sorunun "ilk denemede ve yardımsız" çözülüp çözülmediği. */
  function ilkDenemedeMi(soru) {
    var kz = soru.kazanan;
    return !!kz && kz.deneme_no === 1 && kz.koc_yardimi !== true;
  }

  /* ----------------------------------------------------------- */
  Limit.istatistik = {

    YETERLI_VERI: YETERLI_VERI,
    KONU_ESIGI: KONU_ESIGI,

    /** Ham günlük — ileride Supabase ile birleştirilebilir. */
    gunluk: function () {
      return Limit.depo.denemeGunlugu();
    },

    /**
     * PANELİN TEK VERİ KAYNAĞI.
     * Kartlar da grafikler de yalnızca buradan okur; aynı panelde
     * iki farklı toplam çıkamaz.
     *
     * Demo verisi BELLEKTE durur (Limit.demoVeri), localStorage'a
     * hiç dokunmaz. Önceki sürümde demo kipi gerçek deneme
     * günlüğünü SİLİP yerine örnek kayıt yazıyordu; öğrencinin
     * gerçek geçmişi yok oluyor ve iki veri birbirine karışıyordu.
     */
    aktifGunluk: function () {
      if (Array.isArray(Limit.demoVeri)) return Limit.demoVeri;
      return this.gunluk();
    },

    soruBazinda: function (gunluk) {
      return soruBazinda(gunluk || this.gunluk());
    },

    /**
     * Konu bazında dağılım. Panelin hem özet hem grafik katmanı
     * bunu kullanır.
     */
    konular: function (gunluk) {
      var harita = soruBazinda(gunluk || this.gunluk());
      var konular = {};

      Object.keys(harita).forEach(function (id) {
        var s = harita[id];
        var k = konular[s.konu] || (konular[s.konu] = {
          konu: s.konu,
          brans: s.brans,
          denenen: 0,
          cozulen: 0,
          ilkDenemede: 0,
          toplamDeneme: 0,
          toplamSure: 0,
          sureAdet: 0,
          sonZaman: null
        });

        k.denenen++;
        k.toplamDeneme += s.denemeler.length;
        if (!k.sonZaman || s.sonZaman > k.sonZaman) k.sonZaman = s.sonZaman;

        if (s.kazanan) {
          k.cozulen++;
          if (ilkDenemedeMi(s)) k.ilkDenemede++;
          if (typeof s.kazanan.sure_sn === 'number') {
            k.toplamSure += s.kazanan.sure_sn;
            k.sureAdet++;
          }
        }
      });

      return Object.keys(konular).map(function (ad) {
        var k = konular[ad];
        k.ilkDenemeYuzde = yuzde(k.ilkDenemede, k.denenen);
        k.cozulmeYuzde = yuzde(k.cozulen, k.denenen);
        k.ortalamaSure = k.sureAdet ? Math.round(k.toplamSure / k.sureAdet) : null;

        /* Grafiklerin kullandığı üçlü ayrım. Burada tanımlanır ki
           kart ile grafik asla çelişmesin — grafik katmanı ölçüt
           hesaplamaz, yalnızca bu alanları çizer.

           Sınırsız deneme altında ikili "doğru/yanlış" anlamsızdır:
           yeterince deneyen herkesin her sorusu sonunda "doğru"
           olur. Anlamlı ayrım üçlüdür:                            */
        k.sonradanCozulen = k.cozulen - k.ilkDenemede;   /* tekrar/yardımla */
        k.cozulemeyen     = k.denenen - k.cozulen;       /* hâlâ açık */

        /* Yanlış DENEME sayısı: "yanlışların dağılımı" grafiğinin
           birimi. Soru bazlı değil deneme bazlı — öğrencinin kaç kez
           yanlış işaretlediğini gösterir. */
        k.yanlisDeneme = k.toplamDeneme - k.cozulen;

        /* Örneklem eşiğinin altındaki konular grafikte "yetersiz
           veri" olarak işaretlenir; sıfır gibi gösterilmez. */
        k.yeterliOrneklem = k.denenen >= KONU_ESIGI;

        return k;
      }).sort(function (a, b) { return b.denenen - a.denenen; });
    },

    /**
     * Özet şeridi için tek nesne.
     * yeterliVeri false ise arayüz boş durumu gösterir; kırık
     * grafik ya da "%0" gibi cesaret kırıcı sayı basmaz.
     */
    ozet: function (gunluk) {
      var g = gunluk || this.gunluk();
      var harita = soruBazinda(g);
      var sorular = Object.keys(harita).map(function (id) { return harita[id]; });

      var denenen = sorular.length;
      var cozulen = 0, ilkDenemede = 0, sureToplam = 0, sureAdet = 0;

      sorular.forEach(function (s) {
        if (!s.kazanan) return;
        cozulen++;
        if (ilkDenemedeMi(s)) ilkDenemede++;
        if (typeof s.kazanan.sure_sn === 'number') {
          sureToplam += s.kazanan.sure_sn;
          sureAdet++;
        }
      });

      /* Güçlü konu / odak alanı: yalnızca yeterli örneklem olan
         konular yarışır. Tek soruya bakıp hüküm vermeyiz. */
      var adaylar = this.konular(g).filter(function (k) {
        return k.denenen >= KONU_ESIGI;
      });
      var sirali = adaylar.slice().sort(function (a, b) {
        return b.ilkDenemeYuzde - a.ilkDenemeYuzde;
      });

      var toplamSoru = Limit.veri.sorular().length;

      return {
        yeterliVeri: g.length >= YETERLI_VERI,
        denemeSayisi: g.length,

        denenenSoru: denenen,
        cozulenSoru: cozulen,
        toplamSoru: toplamSoru,
        kapsamYuzde: yuzde(denenen, toplamSoru),

        /* İki ölçüt, AYNI payda: denenen soru sayısı */
        ilkDenemedeSoru: ilkDenemede,
        ilkDenemeYuzde: yuzde(ilkDenemede, denenen),
        sonundaYuzde: yuzde(cozulen, denenen),

        ortalamaSureSn: sureAdet ? Math.round(sureToplam / sureAdet) : null,

        /* İkisi de EN AZ İKİ aday ister. Tek konu varken "güçlü
           konun" demek anlamsız: kıyas yoksa en güçlü de yoktur.
           %33 ile "güçlü konun" yazmak öğrenciyi yanıltırdı. */
        gucluKonu: sirali.length > 1 ? sirali[0] : null,
        odakKonu: sirali.length > 1 ? sirali[sirali.length - 1] : null,
        konuAdayi: adaylar.length
      };
    }
  };

})(window);
