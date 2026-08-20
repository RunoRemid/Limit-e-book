/* =============================================================
   ui-istatistik.js — İstatistik sayfası (Aşama 2: iskelet + özet)
   -------------------------------------------------------------
   DİL İLKESİ
   Öğrenci başka öğrencilerle değil KENDİ geçmişiyle kıyaslanır.
   Zayıf konu "başarısızlık" değil "odak alanı"dır. Sayılar
   cezalandırmaz, yön gösterir.

   Grafikler Aşama 3'te bu iskeletin içine yerleşecek.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;
  var Y = Limit.yrd;

  /* ----------------------------------------------------------- */
  function sureBicimUzun(sn) {
    if (sn === null || sn === undefined) return '—';
    /* "0 sn" bozuk görünüyor; ölçülemeyecek kadar kısa demek. */
    if (sn < 1) return "1 sn'den az";
    if (sn < 60) return sn + ' sn';
    var dk = Math.floor(sn / 60);
    var kalan = sn % 60;
    return kalan ? dk + ' dk ' + kalan + ' sn' : dk + ' dk';
  }

  /* --- Özet kartı ---------------------------------------------
     deger : büyük rakam (Bodoni)
     alt   : ölçütün ne olduğunu söyleyen küçük gri satır
     soluk : ikincil ölçüt — ana ölçütle karışmasın diye daha sönük */
  function kart(secenek) {
    /* Yüzde işareti Bodoni'de çok süslü ve küçük boyutta okunmuyor;
       rakam başlık fontunda, "%" gövde fontunda ayrı bir span. */
    var deger = Y.el('span', {
      class: 'ozet-kart__deger' + (secenek.metinDeger ? ' ozet-kart__deger--metin' : '')
    });
    if (secenek.yuzdeMi) {
      deger.appendChild(Y.el('span', { class: 'ozet-kart__isaret', metin: '%' }));
    }
    deger.appendChild(document.createTextNode(secenek.deger));

    var icerik = [
      Y.el('span', { class: 'ozet-kart__etiket', metin: secenek.etiket }),
      deger
    ];
    if (secenek.alt) {
      icerik.push(Y.el('p', { class: 'ozet-kart__alt', metin: secenek.alt }));
    }
    if (secenek.soluk) {
      icerik.push(Y.el('p', { class: 'ozet-kart__soluk', metin: secenek.soluk }));
    }

    return Y.el('div', {
      class: 'ozet-kart' + (secenek.vurgu ? ' ozet-kart--vurgu' : ''),
      title: secenek.ipucu || null
    }, icerik);
  }

  /* --- Boş durum ----------------------------------------------
     Kırık grafik ya da "%0" göstermek yerine nazik bir davet. */
  function bosDurum(ozet) {
    var kalan = Math.max(0, Limit.istatistik.YETERLI_VERI - ozet.denemeSayisi);

    return Y.el('section', { class: 'kart istatistik-bos' }, [
      Y.el('span', { class: 'istatistik-bos__faset', 'aria-hidden': 'true' }),
      Y.el('h2', { class: 'istatistik-bos__baslik', metin: 'Henüz yeterli veri yok' }),
      Y.el('p', {
        class: 'istatistik-bos__metin',
        metin: ozet.denemeSayisi === 0
          ? 'Birkaç soru çözünce istatistiklerin burada belirir: hangi konularda güçlü olduğun, nerede acele ettiğin ve önce neye çalışman gerektiği.'
          : 'Şu ana kadar ' + ozet.denemeSayisi + ' deneme yaptın. ' + kalan +
            ' deneme daha sonra istatistiklerin burada belirmeye başlayacak.'
      }),
      Y.el('button', {
        class: 'dugme dugme--koc-yardim',
        metin: 'Soru çözmeye dön',
        onclick: function () { Limit.uygulama.istatistikKapat(); }
      })
    ]);
  }

  /* --- Özet şeridi --------------------------------------------- */
  function ozetSeridi(ozet) {
    var kartlar = [];

    kartlar.push(kart({
      etiket: 'Çözülen soru',
      deger: String(ozet.cozulenSoru),
      soluk: ozet.denenenSoru + ' soru denendi · bankanın %' + ozet.kapsamYuzde + "'i",
      ipucu: 'Doğruya ulaştığın soru sayısı'
    }));

    /* Manşet ölçüt. Açıklama satırı ölçütü tanımlar; "sonunda
       çözülen" bilinçli olarak daha sönük, ikisi karışmasın. */
    kartlar.push(kart({
      etiket: 'İlk denemede doğru',
      deger: String(ozet.ilkDenemeYuzde),
      yuzdeMi: true,
      vurgu: true,
      alt: 'İlk denemede doğru = ipucu veya koç olmadan, ilk seferde doğru çözülen sorular.',
      soluk: 'Sonunda çözülen: %' + ozet.sonundaYuzde,
      ipucu: ozet.ilkDenemedeSoru + ' / ' + ozet.denenenSoru + ' soru'
    }));

    kartlar.push(kart({
      etiket: 'Ortalama süre',
      deger: sureBicimUzun(ozet.ortalamaSureSn),
      metinDeger: true,
      soluk: 'Doğruyu bulana kadar geçen süre',
      ipucu: 'Yalnızca çözülen sorular üzerinden'
    }));

    var azOrneklem = 'En az ' + Limit.istatistik.KONU_ESIGI +
                     ' soru denenen konular arasından';

    kartlar.push(kart({
      etiket: 'Güçlü konun',
      deger: ozet.gucluKonu ? ozet.gucluKonu.konu : '—',
      metinDeger: true,
      soluk: ozet.gucluKonu
        ? '%' + ozet.gucluKonu.ilkDenemeYuzde + ' ilk denemede'
        : azOrneklem + ' henüz aday yok',
      ipucu: azOrneklem
    }));

    kartlar.push(kart({
      etiket: 'Odak alanın',
      deger: ozet.odakKonu ? ozet.odakKonu.konu : '—',
      metinDeger: true,
      soluk: ozet.odakKonu
        ? '%' + ozet.odakKonu.ilkDenemeYuzde + ' ilk denemede · buraya çalışmak en çok kazandırır'
        : azOrneklem + ' henüz aday yok',
      ipucu: 'Zayıflık değil, en çok kazanç sağlayacak alan'
    }));

    return Y.el('div', { class: 'ozet-serit' }, kartlar);
  }

  /* --- Sayfa başlığı ------------------------------------------- */
  function baslik(ozet) {
    return Y.el('header', { class: 'istatistik-ust' }, [
      Y.el('div', {}, [
        Y.el('h1', { class: 'istatistik-ust__baslik', metin: 'İstatistiklerim' }),
        Y.el('p', {
          class: 'istatistik-ust__alt',
          metin: 'Kendi geçmişinle kıyaslanıyorsun — başka öğrencilerle değil.'
        })
      ]),
      Y.el('button', {
        class: 'dugme dugme--anahat',
        metin: '← Soruya dön',
        onclick: function () { Limit.uygulama.istatistikKapat(); }
      })
    ]);
  }

  /* --- Grafik kartı -------------------------------------------
     govde: doldurucu fonksiyon. Grafik yoksa (kütüphane gelmediyse)
     aynı veriyi taşıyan tablo döner; kart hiçbir koşulda boş kalmaz. */
  function grafikKarti(id, ad, aciklama, govde) {
    return Y.el('section', { class: 'kart grafik-kart', id: id }, [
      Y.el('header', { class: 'grafik-kart__ust' }, [
        Y.el('h2', { class: 'grafik-kart__baslik', metin: ad }),
        aciklama ? Y.el('p', { class: 'grafik-kart__alt', metin: aciklama }) : null
      ]),
      Y.el('div', { class: 'grafik-kart__govde' }, [govde])
    ]);
  }

  /* Sonraki aşamada dolacak analizler için yer tutucu */
  function yuva(id, ad, aciklama) {
    return Y.el('section', { class: 'kart grafik-kart', id: id }, [
      Y.el('header', { class: 'grafik-kart__ust' }, [
        Y.el('h2', { class: 'grafik-kart__baslik', metin: ad }),
        aciklama ? Y.el('p', { class: 'grafik-kart__alt', metin: aciklama }) : null
      ]),
      Y.el('div', { class: 'grafik-kart__govde' }, [
        Y.el('p', { class: 'grafik-kart__bekliyor', metin: 'Bu görselleştirme bir sonraki aşamada eklenecek.' })
      ])
    ]);
  }

  /* ----------------------------------------------------------- */
  Limit.istatistikSayfa = {

    ciz: function (sahne) {
      var ozet = Limit.istatistik.ozet();
      var ic = Y.el('div', { class: 'sahne__ic istatistik' }, [baslik(ozet)]);

      /* Örnek veriyle açıldıysa bunu görünür biçimde söyle —
         izleyici gerçek öğrenci verisi sanmasın. */
      if (Limit.istatistikOrnekVeri) {
        ic.appendChild(Y.el('p', { class: 'ornek-veri-serit' }, [
          Y.el('strong', { metin: 'Örnek veri · ' }),
          'Bu panel sunum için üretilmiş örnek denemelerle dolduruldu; gerçek kullanım kaydı değildir.'
        ]));
      }

      if (!ozet.yeterliVeri) {
        ic.appendChild(bosDurum(ozet));
      } else {
        var konular = Limit.istatistik.konular();
        Limit.grafik.temaKur();

        ic.appendChild(ozetSeridi(ozet));

        ic.appendChild(grafikKarti('grafikKonu', 'Konu bazında doğru ve yanlış',
          'Sınırsız denemede "doğru/yanlış" ikilisi anlamsızdır; ayrım üçlü yapılır',
          Limit.grafik.konuBari(konular)));

        ic.appendChild(grafikKarti('grafikYanlisDagilim', 'Yanlışların konu dağılımı',
          'Yanlış işaretlemelerin hangi konularda toplandığı',
          Limit.grafik.yanlisHalka(konular)));

        ic.appendChild(grafikKarti('grafikSure', 'Konu bazında ortalama süre',
          'Doğruyu bulana kadar geçen süre',
          Limit.grafik.sureBari(konular)));

        ic.appendChild(yuva('grafikHizIsabet', 'Hız–isabet haritası',
          'Nerede acele ediyorsun, nerede kavram eksiğin var'));
        ic.appendChild(yuva('grafikGelisim', 'Zaman içinde gelişim',
          'Doğruluk ve süre nasıl değişiyor'));

        /* Kütüphane gelmediyse bunu sessizce geçme — panelin
           tablolarla çalıştığını söyle. */
        if (!Limit.grafik.chartVarMi()) {
          ic.appendChild(Y.el('p', { class: 'grafik-uyari' },
            ['Grafik kütüphanesi yüklenemedi (ağ erişimi yok olabilir). ' +
             'Veriler yukarıda tablo olarak gösteriliyor.']));
        }
      }

      Y.bosalt(sahne).appendChild(ic);
    }
  };

})(window);
