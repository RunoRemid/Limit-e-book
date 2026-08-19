/* =============================================================
   ui-yanpanel.js — Üst bardaki branş sekmeleri + sayfa/soru ağacı
   Ağaç yapısı: branş → kitap sayfası (test) → sorular
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;
  var Y = Limit.yrd;

  var kapBranslar, kapAgac;
  var acikSayfalar = {};   // sayfaId → true

  /* ----------------------------------------------------------- */
  function bransSekmeleriCiz() {
    var durum = Limit.depo.al();
    Y.bosalt(kapBranslar);

    Limit.veri.branslar().forEach(function (b) {
      var ozet = Limit.veri.ozet(b.id);
      kapBranslar.appendChild(Y.el('button', {
        class: 'brans-sekme',
        role: 'tab',
        'aria-selected': String(durum.aktifBrans === b.id),
        style: '--brans-renk:' + b.renk,
        title: b.ad + ' — ' + ozet.cozulen + '/' + ozet.toplam + ' soru işaretlendi',
        onclick: function () { Limit.uygulama.bransSec(b.id); }
      }, [
        Y.el('span', { class: 'brans-sekme__nokta' }),
        b.ad
      ]));
    });
  }

  /* ----------------------------------------------------------- */
  function agacCiz() {
    var durum = Limit.depo.al();
    Y.bosalt(kapAgac);

    if (!durum.aktifBrans) {
      kapAgac.appendChild(Y.el('p', { class: 'yanpanel__baslik', metin: 'Önce bir branş seçin' }));
      return;
    }

    var brans = Limit.veri.brans(durum.aktifBrans);
    kapAgac.appendChild(Y.el('div', { class: 'yanpanel__baslik', metin: brans.ad + ' · Kitap Sayfaları' }));

    Limit.veri.sayfalar(durum.aktifBrans).forEach(function (s) {
      var sorular = Limit.veri.sorular(s.id);
      if (!sorular.length) return;

      var acikMi = acikSayfalar[s.id];
      if (acikMi === undefined) {
        acikMi = sorular.some(function (q) { return q.id === durum.aktifSoruId; });
      }
      acikSayfalar[s.id] = acikMi;

      var ozet = Limit.veri.sayfaOzeti(s.id);
      var liste = Y.el('ul', { class: 'unite__liste' });

      sorular.forEach(function (q) {
        /* Sınırsız deneme: soru ya çözüldü ya da üzerinde çalışılıyor.
           "Yanlış" diye kalıcı bir damga yok. */
        var kayit = durum.ilerleme[q.id];
        var isaret = '', sinif = '';
        if (kayit && kayit.cozuldu) {
          isaret = '✓'; sinif = ' soru-satir__durum--dogru';
        } else if (kayit && (kayit.denemeler || []).length) {
          isaret = '•'; sinif = ' soru-satir__durum--notr';
        }

        liste.appendChild(Y.el('li', {}, [
          Y.el('button', {
            class: 'soru-satir',
            'aria-current': String(durum.aktifSoruId === q.id),
            onclick: function () { Limit.uygulama.soruAc(q.id); }
          }, [
            Y.el('span', { metin: q.no + '. soru' }),
            Y.el('span', { class: 'soru-satir__durum' + sinif, metin: isaret })
          ])
        ]));
      });

      var kutu = Y.el('div', { class: 'unite', 'data-acik': acikMi ? 'evet' : 'hayir' }, [
        Y.el('button', {
          class: 'unite__baslik',
          'aria-expanded': String(acikMi),
          onclick: function (e) {
            var kap = e.currentTarget.parentNode;
            var yeni = kap.getAttribute('data-acik') !== 'evet';
            kap.setAttribute('data-acik', yeni ? 'evet' : 'hayir');
            e.currentTarget.setAttribute('aria-expanded', String(yeni));
            acikSayfalar[s.id] = yeni;
          }
        }, [
          Y.el('span', { class: 'unite__ok', metin: '▶' }),
          Y.el('span', { class: 'unite__ad' }, [
            Y.el('span', { class: 'unite__konu', metin: s.konu }),
            Y.el('span', { class: 'unite__alt', metin: 'Test ' + s.test + ' · s.' + s.kitapSayfa })
          ]),
          s.anahtarKaynagi !== 'sayfa'
            ? Y.el('span', {
                class: 'nokta-uyari',
                title: 'Bu sayfanın cevap anahtarı kitapta basılı değil — cevaplar çözülerek ya da demo amaçlı dolduruldu.'
              })
            : null,
          Y.el('span', { class: 'unite__sayac', metin: ozet.cozulen + '/' + ozet.toplam })
        ]),
        liste
      ]);

      kapAgac.appendChild(kutu);
    });
  }

  /* ----------------------------------------------------------- */
  Limit.yanpanel = {
    baglat: function () {
      kapBranslar = Y.sec('#bransSekmeleri');
      kapAgac = Y.sec('#konuAgaci');

      bransSekmeleriCiz();
      agacCiz();

      Limit.olay.dinle('durum:degisti', function () {
        bransSekmeleriCiz();
        agacCiz();
      });
    }
  };

})(window);
