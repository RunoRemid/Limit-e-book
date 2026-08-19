/* =============================================================
   veri-servis.js — window.LimitVeri üzerine sorgu katmanı
   Model: branş → sayfa → soru
   Arayüz katmanları ham diziye değil yalnızca bu servise bakar.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit || (global.Limit = {});

  Limit.veri = (function () {
    var kaynak = null;
    var dizin = { brans: {}, sayfa: {}, soru: {} };
    var tumSorular = [];

    function dizinle() {
      dizin = { brans: {}, sayfa: {}, soru: {} };
      tumSorular = [];

      (kaynak.branslar || []).forEach(function (b) { dizin.brans[b.id] = b; });

      (kaynak.sayfalar || []).forEach(function (s) {
        dizin.sayfa[s.id] = s;
        s.sorular.forEach(function (q) {
          dizin.soru[q.id] = q;
          tumSorular.push(q);
        });
      });
    }

    return {

      hazirMi: function () {
        return !!(global.LimitVeri && Array.isArray(global.LimitVeri.sayfalar));
      },

      baglat: function () {
        if (!this.hazirMi()) {
          throw new Error('LimitVeri bulunamadı — data/veri.js, index.html içinde src betiklerinden ÖNCE yüklenmeli.');
        }
        kaynak = global.LimitVeri;
        dizinle();
        return kaynak.meta;
      },

      meta: function () { return kaynak.meta; },

      /* --- branş --- */
      branslar: function () { return kaynak.branslar.slice(); },
      brans: function (id) { return dizin.brans[id] || null; },

      /* --- sayfa --- */
      sayfalar: function (bransId) {
        return kaynak.sayfalar
          .filter(function (s) { return !bransId || s.brans === bransId; })
          .sort(function (a, b) { return a.kitapSayfa - b.kitapSayfa; });
      },
      sayfa: function (id) { return dizin.sayfa[id] || null; },

      /* --- soru --- */
      sorular: function (sayfaId) {
        if (!sayfaId) return tumSorular.slice();
        var s = this.sayfa(sayfaId);
        return s ? s.sorular.slice() : [];
      },
      soru: function (id) { return dizin.soru[id] || null; },

      /* Bir sorunun bağlı olduğu sayfa */
      soruSayfasi: function (soruId) {
        var q = this.soru(soruId);
        return q ? this.sayfa(q.sayfa) : null;
      },

      /* --- konu rehberi (Sokratik omurga) --- */
      rehber: function (anahtar) {
        return (kaynak.konuRehberi && kaynak.konuRehberi[anahtar]) || null;
      },

      soruRehberi: function (soruId) {
        var s = this.soruSayfasi(soruId);
        return s ? this.rehber(s.rehber) : null;
      },

      /* --- gezinme: branş içindeki tüm sorular sayfa sırasıyla --- */
      bransSorulari: function (bransId) {
        var liste = [];
        this.sayfalar(bransId).forEach(function (s) {
          s.sorular.forEach(function (q) { liste.push(q); });
        });
        return liste;
      },

      komsu: function (soruId, yon) {
        var q = this.soru(soruId);
        if (!q) return null;
        var s = this.sayfa(q.sayfa);
        var liste = this.bransSorulari(s.brans);
        var i = liste.findIndex(function (x) { return x.id === soruId; });
        return liste[i + (yon === 'onceki' ? -1 : 1)] || null;
      },

      /* Cevap anahtarı bu soru için var mı? */
      anahtarVarMi: function (soruId) {
        var q = this.soru(soruId);
        return !!(q && q.dogru);
      },

      gorselAdi: function (yol) { return String(yol || '').split('/').pop(); },

      /* --- istatistik --- */
      /* Deneme hakkı sınırsız olduğundan "doğru/yanlış oranı" anlamsızdır —
         herkes eninde sonunda doğruyu bulur. Anlamlı ölçü, soruyu İLK
         denemede çözme oranı ve harcanan toplam deneme sayısıdır. */
      ozet: function (bransId) {
        var liste = bransId ? this.bransSorulari(bransId) : tumSorular;
        var durum = Limit.depo.al();
        var cozulen = 0, ilkDenemede = 0, denendi = 0, toplamDeneme = 0, anahtarli = 0;

        liste.forEach(function (q) {
          if (q.dogru) anahtarli++;
          var k = durum.ilerleme[q.id];
          if (!k) return;
          var d = (k.denemeler || []).length;
          if (d) { denendi++; toplamDeneme += d; }
          if (k.cozuldu) {
            cozulen++;
            if (d === 1) ilkDenemede++;
          }
        });

        return {
          toplam: liste.length,
          anahtarli: anahtarli,
          denendi: denendi,
          cozulen: cozulen,
          ilkDenemede: ilkDenemede,
          toplamDeneme: toplamDeneme,
          ilkDenemeYuzde: cozulen ? Math.round((ilkDenemede / cozulen) * 100) : 0,
          ortalamaDeneme: cozulen ? Math.round((toplamDeneme / cozulen) * 10) / 10 : 0
        };
      },

      sayfaOzeti: function (sayfaId) {
        var liste = this.sorular(sayfaId);
        var durum = Limit.depo.al();
        var cozulen = liste.filter(function (q) {
          var k = durum.ilerleme[q.id];
          return k && k.cozuldu;
        }).length;
        return { toplam: liste.length, cozulen: cozulen };
      }
    };
  })();

})(window);
