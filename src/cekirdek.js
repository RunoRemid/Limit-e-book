/* =============================================================
   cekirdek.js — Uygulama çekirdeği
   · Limit ad alanı        · Yardımcılar (DOM, biçimleme)
   · Olay veri yolu        · Durum deposu + localStorage kalıcılığı
   Bağımlılık: yok. İlk yüklenen betik budur.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit || (global.Limit = {});

  Limit.surum = '0.5.0-demo';
  Limit.DEPO_ANAHTARI = 'limit.sayisal.demo.v1';
  Limit.DENEME_TAVANI = 500;   /* yerel deneme günlüğünde tutulan kayıt sayısı */

  /* ===========================================================
     1) Yardımcılar
     =========================================================== */
  var Y = Limit.yrd = {

    sec: function (secici, kok) { return (kok || document).querySelector(secici); },
    secTum: function (secici, kok) {
      return Array.prototype.slice.call((kok || document).querySelectorAll(secici));
    },

    /* el('div', {class:'x', 'data-a':'1'}, ['metin', baskaEleman]) */
    el: function (etiket, ozellikler, cocuklar) {
      var d = document.createElement(etiket);
      if (ozellikler) {
        Object.keys(ozellikler).forEach(function (ad) {
          var deger = ozellikler[ad];
          if (deger === null || deger === undefined || deger === false) return;
          if (ad === 'class') d.className = deger;
          else if (ad === 'metin') d.textContent = deger;
          else if (ad === 'html') d.innerHTML = deger;
          else if (ad.indexOf('on') === 0 && typeof deger === 'function') {
            d.addEventListener(ad.slice(2).toLowerCase(), deger);
          } else d.setAttribute(ad, deger);
        });
      }
      (cocuklar || []).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        d.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
      return d;
    },

    bosalt: function (dugum) {
      while (dugum && dugum.firstChild) dugum.removeChild(dugum.firstChild);
      return dugum;
    },

    /* 125 → "02:05" */
    sureBicim: function (saniye) {
      var s = Math.max(0, Math.floor(saniye || 0));
      var dk = Math.floor(s / 60);
      var sn = s % 60;
      return (dk < 10 ? '0' : '') + dk + ':' + (sn < 10 ? '0' : '') + sn;
    },

    kacis: function (metin) {
      return String(metin === undefined || metin === null ? '' : metin)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    /* Zaman damgası — kayıt/rapor için */
    simdi: function () { return new Date().toISOString(); },

    gecikmeli: function (fn, ms) {
      var zaman;
      return function () {
        var kap = this, arg = arguments;
        clearTimeout(zaman);
        zaman = setTimeout(function () { fn.apply(kap, arg); }, ms);
      };
    },

    karistir: function (dizi) {
      var d = dizi.slice(), i, j, t;
      for (i = d.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        t = d[i]; d[i] = d[j]; d[j] = t;
      }
      return d;
    }
  };

  /* ===========================================================
     2) Olay veri yolu
     =========================================================== */
  Limit.olay = (function () {
    var kayit = {};
    return {
      dinle: function (ad, isleyici) {
        (kayit[ad] || (kayit[ad] = [])).push(isleyici);
        return function () { Limit.olay.birak(ad, isleyici); };
      },
      birak: function (ad, isleyici) {
        if (!kayit[ad]) return;
        kayit[ad] = kayit[ad].filter(function (f) { return f !== isleyici; });
      },
      yayinla: function (ad, veri) {
        (kayit[ad] || []).forEach(function (f) {
          try { f(veri); }
          catch (h) { console.error('[Limit] olay hatası: ' + ad, h); }
        });
      }
    };
  })();

  /* ===========================================================
     3) Kalıcılık — localStorage (file:// altında da çalışır)
     =========================================================== */
  var Kalici = Limit.kalici = {
    kullanilabilir: (function () {
      try {
        var a = '__limit_test__';
        global.localStorage.setItem(a, '1');
        global.localStorage.removeItem(a);
        return true;
      } catch (h) { return false; }
    })(),

    oku: function (varsayilan) {
      if (!this.kullanilabilir) return varsayilan;
      try {
        var ham = global.localStorage.getItem(Limit.DEPO_ANAHTARI);
        return ham ? JSON.parse(ham) : varsayilan;
      } catch (h) {
        console.warn('[Limit] kayıt okunamadı, sıfırlanıyor.', h);
        return varsayilan;
      }
    },

    yaz: function (nesne) {
      if (!this.kullanilabilir) return false;
      try {
        global.localStorage.setItem(Limit.DEPO_ANAHTARI, JSON.stringify(nesne));
        return true;
      } catch (h) {
        console.warn('[Limit] kayıt yazılamadı.', h);
        return false;
      }
    },

    temizle: function () {
      if (!this.kullanilabilir) return;
      global.localStorage.removeItem(Limit.DEPO_ANAHTARI);
    }
  };

  /* ===========================================================
     4) Durum deposu
     -----------------------------------------------------------
     Tek yönlü akış: guncelle() → kaydet → 'durum:degisti' olayı
     Arayüz katmanları yalnızca olayı dinler, durumu doğrudan
     değiştirmez.
     =========================================================== */
  var BASLANGIC = {
    aktifBrans: null,        // 'matematik' | ... | null (karşılama)
    aktifSoruId: null,
    yanAcik: true,
    /* kocAcik kaldırıldı — koç sabit panel değil, açılır pencere. */
    tamSayfa: false,         // taramada odak kipi mi tam sayfa mı
    yakinlik: 1,             // 1 | 1.25 | 1.5 | 2 | 2.5
    // ilerleme[soruId] = { secim, dogruMu, sureSn, ipucuKademe, tamamlandi, zaman }
    ilerleme: {},
    // koç oturumları: sohbet[soruId] = [{rol:'koc'|'ogrenci', metin, zaman}]
    sohbet: {},
    /* Deneme günlüğü — istatistik panelinin BİRİNCİL kaynağı.
       ilerleme[] yalnızca "hangi harfler denendi"yi tutuyor; panel
       için her denemenin zamanı, süresi ve bağlamı gerekiyor.
       Yerel öncelikli mimari: panel ağ olmadan da bu günlükten
       dolar, Supabase yalnızca cihazlar arası zenginleştirmedir. */
    denemeGunlugu: [],
    ayarlar: {
      aiSaglayici: 'yerel',   // 'yerel' | 'uzak'
      aiUcNokta: '',          // uzak modda proxy adresi
      sesliUyari: false
    }
  };

  function derinBirlestir(hedef, kaynak) {
    var sonuc = {}, ad;
    for (ad in hedef) if (Object.prototype.hasOwnProperty.call(hedef, ad)) sonuc[ad] = hedef[ad];
    for (ad in kaynak) {
      if (!Object.prototype.hasOwnProperty.call(kaynak, ad)) continue;
      var d = kaynak[ad];
      if (d && typeof d === 'object' && !Array.isArray(d) && hedef[ad] && typeof hedef[ad] === 'object' && !Array.isArray(hedef[ad])) {
        sonuc[ad] = derinBirlestir(hedef[ad], d);
      } else {
        sonuc[ad] = d;
      }
    }
    return sonuc;
  }

  Limit.depo = (function () {
    var durum = derinBirlestir(BASLANGIC, Kalici.oku({}) || {});

    var kaydet = Y.gecikmeli(function () { Kalici.yaz(durum); }, 220);

    return {
      al: function () { return durum; },

      /* Kısmi güncelleme; sığ birleştirme yeterli, iç içe alanlar için
         yardımcı yöntemler aşağıda. */
      guncelle: function (yama, sessiz) {
        durum = derinBirlestir(durum, yama || {});
        kaydet();
        if (!sessiz) Limit.olay.yayinla('durum:degisti', durum);
        return durum;
      },

      /* Bir sorunun ilerleme kaydını yaz.
         sessiz=true → yalnız diske yazar, arayüzü yeniden çizdirmez.
         (Kronometrenin saniyelik kaydı tüm ağacı boşuna çizmesin.) */
      ilerlemeYaz: function (soruId, yama, sessiz) {
        /* denemeler: sırayla işaretlenen şıklar. Öğrencinin deneme hakkı
           sınırsızdır; kayıt yalnızca istatistik için tutulur.
           cozuldu: doğru şık bulunduğunda true olur. */
        var mevcut = durum.ilerleme[soruId] || {
          secim: null, denemeler: [], dogruMu: null, cozuldu: false,
          sureSn: 0, ipucuKademe: 0, tamamlandi: false
        };
        var yeni = derinBirlestir(mevcut, yama);
        yeni.zaman = Y.simdi();
        durum.ilerleme[soruId] = yeni;
        kaydet();
        if (sessiz) return yeni;
        Limit.olay.yayinla('ilerleme:degisti', { soruId: soruId, kayit: yeni });
        Limit.olay.yayinla('durum:degisti', durum);
        return yeni;
      },

      ilerlemeAl: function (soruId) {
        return durum.ilerleme[soruId] || null;
      },

      /* --- Deneme günlüğü ------------------------------------
         Her şık işaretlemesi bir satır. Tavan aşılınca en eski
         kayıtlar düşer; localStorage kotasını koruyoruz.
         ~500 kayıt × ~200 bayt ≈ 100 KB, güvenli aralık. */
      denemeEkle: function (kayit) {
        var g = durum.denemeGunlugu || (durum.denemeGunlugu = []);
        g.push(kayit);
        if (g.length > Limit.DENEME_TAVANI) {
          g.splice(0, g.length - Limit.DENEME_TAVANI);
        }
        kaydet();
        Limit.olay.yayinla('deneme:eklendi', kayit);
        return kayit;
      },

      denemeGunlugu: function () {
        return (durum.denemeGunlugu || []).slice();
      },

      denemeGunluguSil: function () {
        durum.denemeGunlugu = [];
        kaydet();
        Limit.olay.yayinla('durum:degisti', durum);
      },

      /* Koç sohbet geçmişi */
      sohbetEkle: function (soruId, rol, metin) {
        var dizi = durum.sohbet[soruId] || (durum.sohbet[soruId] = []);
        var kayit = { rol: rol, metin: metin, zaman: Y.simdi() };
        dizi.push(kayit);
        if (dizi.length > 60) dizi.splice(0, dizi.length - 60); // hafıza tavanı
        kaydet();
        return kayit;
      },

      sohbetAl: function (soruId) { return durum.sohbet[soruId] || []; },

      sohbetSil: function (soruId) {
        delete durum.sohbet[soruId];
        kaydet();
        Limit.olay.yayinla('sohbet:temizlendi', { soruId: soruId });
      },

      sifirla: function () {
        Kalici.temizle();
        durum = derinBirlestir(BASLANGIC, {});
        Limit.olay.yayinla('durum:degisti', durum);
        Limit.olay.yayinla('depo:sifirlandi', durum);
      }
    };
  })();

  /* ===========================================================
     5) Bildirim (hafif tost)
     =========================================================== */
  Limit.bildir = function (metin, sure) {
    var alan = Y.sec('#bildirimAlani');
    if (!alan) return;
    var kutu = Y.el('div', { class: 'bildirim', role: 'status', metin: metin });
    alan.appendChild(kutu);
    setTimeout(function () {
      kutu.style.opacity = '0';
      kutu.style.transition = 'opacity 200ms';
      setTimeout(function () { kutu.remove(); }, 220);
    }, sure || 2600);
  };

})(window);
