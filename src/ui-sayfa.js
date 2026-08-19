/* =============================================================
   ui-sayfa.js — Sahne: karşılama + kitap sayfası görüntüleyici
   -------------------------------------------------------------
   ODAK MATEMATİĞİ
   Tarama 1544 × 1920 ve iki sütunlu. Seçili sorunun bölgesini
   ekrana yaymak için görsel büyütülüp kaydırılır. Kaydırma
   `transform` ile DEĞİL, yüzde `margin` ile yapılır:

     · Yüzde margin (yatay da düşey de) kapsayıcının GENİŞLİĞİNE
       göre çözülür → tek bir orana bağlı, JS'siz responsive.
     · transform kullanılsaydı alt piksel konumlanması nedeniyle
       denklemler ve şekiller hafif bulanıklaşabilirdi.

   K   = 100 / bolge.en * yakinlik      (görsel genişliği, kapsayıcı katı)
   ml% = -(bolge.x  · K)
   mt% = -(bolge.y  · K · oran)          oran = doğalBoy / doğalEn
   pb% =  (bolge.boy · K · oran)         pencere yüksekliği

   Tam sayfa kipi aynı formülün bolge = {0,0,100,100} hâlidir.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;
  var Y = Limit.yrd;

  var sahne;
  var kronoZaman = null;
  var gecenSn = 0;

  var TAM_SAYFA_BOLGE = { x: 0, y: 0, en: 100, boy: 100 };
  var YAKINLIK_KADEMELERI = [1, 1.25, 1.5, 2, 2.5];

  /* Son çizilen soru. Kart giriş animasyonu YALNIZCA soru
     değiştiğinde oynasın; yakınlaştırma ve tam sayfa geçişi de
     kartı yeniden çiziyor, onlarda animasyon rahatsız ederdi. */
  var sonCizilenSoru = null;

  /* ===========================================================
     Kronometre
     =========================================================== */
  function kronoDurdur() {
    if (kronoZaman) { clearInterval(kronoZaman); kronoZaman = null; }
  }

  function kronoBaslat(soru, baslangic) {
    kronoDurdur();
    gecenSn = baslangic || 0;
    var gosterge = Y.sec('#kronometre');
    if (!gosterge) return;

    function bas() { gosterge.firstChild.nodeValue = Y.sureBicim(gecenSn); }
    bas();

    kronoZaman = setInterval(function () {
      gecenSn++;
      bas();
      if (gecenSn % 10 === 0) Limit.depo.ilerlemeYaz(soru.id, { sureSn: gecenSn }, true);
    }, 1000);
  }

  /* ===========================================================
     Tarama penceresi
     =========================================================== */
  function taramaKur(sayfa, bolge, yakinlik) {
    var oran = sayfa.boy / sayfa.en;
    var K = (100 / bolge.en) * yakinlik;

    var pencere = Y.el('div', {
      class: 'tarama__pencere',
      style: 'padding-bottom:' + (bolge.boy * K * oran).toFixed(4) + '%'
    });

    var img = Y.el('img', {
      class: 'tarama__gorsel',
      src: sayfa.gorsel,
      alt: sayfa.konu + ' · Test ' + sayfa.test + ' · kitap sayfası ' + sayfa.kitapSayfa,
      decoding: 'async',
      style: 'width:' + (K * 100).toFixed(4) + '%;' +
             'margin-left:' + (-bolge.x * K).toFixed(4) + '%;' +
             'margin-top:' + (-bolge.y * K * oran).toFixed(4) + '%;'
    });

    img.addEventListener('load', function () { pencere.setAttribute('data-yuklendi', 'evet'); });

    img.addEventListener('error', function () {
      pencere.setAttribute('data-hata', 'evet');
      pencere.removeAttribute('style');
      Y.bosalt(pencere).appendChild(
        Y.el('div', { class: 'gorsel-yok' }, [
          Y.el('strong', { metin: 'Tarama bulunamadı' }),
          Y.el('code', { metin: Limit.veri.gorselAdi(sayfa.gorsel) }),
          Y.el('span', { metin: 'Dosyanın img/sorular/ altında ve adının veri.js ile birebir aynı olduğundan emin ol.' })
        ])
      );
    });

    pencere.appendChild(img);
    return pencere;
  }

  /* ===========================================================
     Karşılama
     =========================================================== */
  function karsilamaCiz() {
    var meta = Limit.veri.meta();
    var kartlar = Y.el('div', { class: 'karsilama__kartlar' });

    Limit.veri.branslar().forEach(function (b) {
      var ozet = Limit.veri.ozet(b.id);
      var sayfaSayisi = Limit.veri.sayfalar(b.id).length;
      kartlar.appendChild(Y.el('button', {
        class: 'brans-kart',
        style: '--brans-renk:' + b.renk,
        onclick: function () { Limit.uygulama.bransSec(b.id); }
      }, [
        Y.el('span', { class: 'brans-kart__ikon', metin: b.ikon }),
        Y.el('span', { class: 'brans-kart__ad', metin: b.ad }),
        Y.el('span', { class: 'brans-kart__sayi', metin: sayfaSayisi + ' sayfa · ' + ozet.toplam + ' soru' })
      ]));
    });

    Y.bosalt(sahne).appendChild(
      Y.el('div', { class: 'sahne__ic' }, [
        Y.el('section', { class: 'karsilama kart' }, [
          Y.el('h1', { class: 'karsilama__baslik', metin: meta.urun }),
          Y.el('p', {
            class: 'karsilama__alt',
            metin: 'Orijinal kitap sayfaları üzerinde çalış. Takıldığında Limit Koç sana cevabı değil yolu göstersin. Başlamak için bir branş seç.'
          }),
          kartlar
        ])
      ])
    );
  }

  /* -----------------------------------------------------------
     Cevap anahtarının kaynağını gösteren rozet.
     Kitabın basılı anahtarından gelen sorularda rozet yoktur;
     diğerlerinde küçük ve sessiz bir uyarı bırakılır ki demo
     verisi resmî anahtar sanılmasın.
     ----------------------------------------------------------- */
  function anahtarRozeti(soru) {
    if (!soru.dogru) {
      return Y.el('span', { class: 'rozet rozet--uyari', metin: 'anahtar bekleniyor' });
    }
    if (soru.anahtarKaynagi === 'cozuldu') {
      return Y.el('span', {
        class: 'rozet rozet--not',
        metin: 'çözülerek bulundu',
        title: 'Bu sorunun anahtarı kitap sayfasında basılı değildi; soru çözülerek bulundu. Yayına girmeden resmî anahtarla karşılaştırılmalı.'
      });
    }
    if (soru.anahtarKaynagi === 'demo') {
      return Y.el('span', {
        class: 'rozet rozet--uyari',
        metin: 'demo anahtarı',
        title: 'Bu değer yalnızca demo akışı çalışsın diye atanmıştır; doğruluğu iddia edilmez. Yayına girmeden düzeltilmeli.'
      });
    }
    return null;
  }

  /* ===========================================================
     Soru görünümü
     =========================================================== */
  function soruCiz(soru) {
    var sayfa = Limit.veri.soruSayfasi(soru.id);
    var brans = Limit.veri.brans(sayfa.brans);
    var durum = Limit.depo.al();
    var kayit = durum.ilerleme[soru.id] || {};
    /* tamamlandi yerine cozuldu kullanılıyor — sınırsız deneme modeli */
    var anahtarli = !!soru.dogru;

    var tamSayfa = durum.tamSayfa;
    var yakinlik = durum.yakinlik || 1;

    /* --- künye --- */
    var zorluk = Y.el('span', { class: 'zorluk', title: 'Zorluk ' + soru.zorluk + '/3' },
      [1, 2, 3].map(function (n) {
        return Y.el('span', { class: 'zorluk__cubuk' + (n <= soru.zorluk ? ' zorluk__cubuk--dolu' : '') });
      })
    );

    var kunye = Y.el('header', { class: 'soru-ust' }, [
      Y.el('span', { class: 'rozet rozet--sinav', metin: sayfa.sinav }),
      Y.el('span', { class: 'soru-ust__konu', metin: sayfa.konu }),
      Y.el('span', { class: 'soru-ust__kod', metin: 'Test ' + sayfa.test + ' · s.' + sayfa.kitapSayfa }),
      Y.el('span', { class: 'soru-ust__sag' }, [
        zorluk,
        Y.el('span', { class: 'kronometre', id: 'kronometre' }, [document.createTextNode('00:00')])
      ])
    ]);

    /* --- soru şeridi + görüntüleme denetimleri --- */
    var serit = Y.el('div', { class: 'serit' });

    var numaralar = Y.el('div', { class: 'serit__numaralar', role: 'tablist', 'aria-label': 'Sayfadaki sorular' });
    Limit.veri.sorular(sayfa.id).forEach(function (q) {
      var k = durum.ilerleme[q.id];
      var sinif = 'serit__no';
      if (k && k.cozuldu) sinif += ' serit__no--dogru';
      else if (k && (k.denemeler || []).length) sinif += ' serit__no--isaretli';
      numaralar.appendChild(Y.el('button', {
        class: sinif,
        role: 'tab',
        'aria-selected': String(q.id === soru.id),
        metin: String(q.no),
        title: q.no + '. soru',
        onclick: function () { Limit.uygulama.soruAc(q.id); }
      }));
    });

    var denetim = Y.el('div', { class: 'serit__denetim' }, [
      Y.el('button', {
        class: 'dugme dugme--kucuk dugme--anahat',
        metin: tamSayfa ? 'Soruya odaklan' : 'Tam sayfa',
        title: 'Odak ve tam sayfa görünümü arasında geçiş (T)',
        onclick: function () { Limit.uygulama.tamSayfaAcKapa(); }
      }),
      Y.el('div', { class: 'yakinlik' }, [
        Y.el('button', {
          class: 'yakinlik__dugme', metin: '−', title: 'Uzaklaş',
          'aria-label': 'Uzaklaş',
          onclick: function () { Limit.uygulama.yakinlikDegistir(-1); }
        }),
        Y.el('span', { class: 'yakinlik__deger', metin: '%' + Math.round(yakinlik * 100) }),
        Y.el('button', {
          class: 'yakinlik__dugme', metin: '+', title: 'Yakınlaş',
          'aria-label': 'Yakınlaş',
          onclick: function () { Limit.uygulama.yakinlikDegistir(1); }
        })
      ])
    ]);

    serit.appendChild(numaralar);
    serit.appendChild(denetim);

    /* --- tarama --- */
    var bolge = tamSayfa ? TAM_SAYFA_BOLGE : soru.bolge;
    var tarama = Y.el('div', { class: 'tarama', 'data-kip': tamSayfa ? 'tam' : 'odak' }, [
      taramaKur(sayfa, bolge, yakinlik)
    ]);

    if (!tamSayfa) {
      tarama.appendChild(Y.el('p', {
        class: 'tarama__not',
        metin: soru.no + '. soruya odaklanıldı · tam sayfayı görmek için yukarıdaki düğmeyi kullan'
      }));
    }

    /* --- şıklar --- */
    var geribildirim = Y.el('div', { class: 'geribildirim', id: 'geribildirim', role: 'status' });
    var siklar = Y.el('div', { class: 'siklar', role: 'group', 'aria-label': 'Cevap şıkları' });

    var denemeler = kayit.denemeler || [];
    var cozuldu = !!kayit.cozuldu;

    soru.secenekler.forEach(function (harf) {
      var denendi = denemeler.indexOf(harf) > -1;
      var d = Y.el('button', {
        class: 'sik',
        'aria-pressed': String(denendi),
        'data-harf': harf,
        metin: harf,
        onclick: function () { sikSec(soru, harf); }
      });

      if (cozuldu) {
        /* Çözülmüş soru: tümü kilitli, doğru yeşil, denenmiş yanlışlar kırmızı. */
        d.setAttribute('disabled', 'disabled');
        if (harf === soru.dogru) d.setAttribute('data-sonuc', 'dogru');
        else if (denendi) d.setAttribute('data-sonuc', 'yanlis');
      } else if (denendi) {
        /* Henüz çözülmedi: yalnızca denenmiş şıklar işaretli.
           Doğru cevaba dair hiçbir ipucu sızdırılmaz. */
        d.setAttribute('data-sonuc', anahtarli ? 'yanlis' : 'isaretli');
        if (anahtarli) d.setAttribute('disabled', 'disabled');
      }

      siklar.appendChild(d);
    });

    /* Şıklar taranmış sayfanın İÇİNDE de yazılı. Görsele dokunamadığımız
       için buradaki alan yalnızca HARF taşır ve altındaki satır iki
       gösterimin ilişkisini açıkça kurar. */
    var cevapAlani = Y.el('div', { class: 'cevap-alani' }, [
      siklar,
      Y.el('p', {
        class: 'cevap-ipucu',
        metin: 'Yukarıdaki şıklardan birini işaretle.'
      })
    ]);

    /* --- yardım grubu: koç ve video, sorunun hemen altında --- */
    var eylemGrubu = Y.el('div', { class: 'eylem-grup' }, [
      Y.el('button', {
        class: 'dugme dugme--koc-yardim',
        title: 'Sokratik koç ipucu versin (K)',
        onclick: function () { Limit.koc.ac('yardim'); }
      }, [
        Y.el('span', { class: 'eylem-grup__ikon', 'aria-hidden': 'true', metin: '◈' }),
        Y.el('span', { metin: "Koç'tan yardım al" })
      ]),
      Y.el('button', {
        class: 'dugme dugme--koc-cozum',
        title: 'Koç soruyu adım adım çözsün (Ç)',
        onclick: function () { Limit.koc.ac('cozum'); }
      }, [
        Y.el('span', { class: 'eylem-grup__ikon', 'aria-hidden': 'true', metin: '✓' }),
        Y.el('span', { metin: 'Koç çözsün' })
      ]),
      soru.video_url ? Y.el('button', {
        class: 'video-dugme',
        title: 'Öğretmen çözümü videosunu aç (V)',
        onclick: function () { Limit.uygulama.videoAc(soru); }
      }, [
        Y.el('span', { class: 'video-dugme__play', 'aria-hidden': 'true', metin: '▶' }),
        Y.el('span', { metin: 'Öğretmen Çözümü İzle' })
      ]) : null
    ]);

    /* --- eylemler --- */
    var eylemler = Y.el('footer', { class: 'eylemler' }, [
      Y.el('button', {
        class: 'dugme dugme--anahat', id: 'dugmeOnceki', metin: '← Önceki',
        onclick: function () { Limit.uygulama.gez('onceki'); }
      }),
      Y.el('span', { class: 'eylemler__ara' }),
      anahtarRozeti(soru),
      Y.el('button', {
        class: 'dugme dugme--birincil', id: 'dugmeSonraki', metin: 'Sonraki →',
        onclick: function () { Limit.uygulama.gez('sonraki'); }
      })
    ]);

    /* --- ilerleme --- */
    var ozet = Limit.veri.ozet(sayfa.brans);
    var yuzde = ozet.toplam ? Math.round((ozet.cozulen / ozet.toplam) * 100) : 0;
    var ilerleme = Y.el('div', { class: 'kart ilerleme' }, [
      Y.el('span', {
        class: 'rozet',
        style: 'background:' + brans.renk + '1A;color:' + brans.renk,
        metin: brans.ad
      }),
      Y.el('div', { class: 'ilerleme__cubuk' }, [
        /* data-bos: hiç ilerleme yokken faset ucu gösterilmez,
           yoksa şeridin başında anlamsız bir ok gibi durur. */
        /* Sıfırdan başlar, bir sonraki karede hedefe geçer; CSS
           geçişi böylece tetiklenir ve çubuk dolarak gelir. */
        Y.el('div', {
          class: 'ilerleme__dolu',
          id: 'ilerlemeDolu',
          'data-bos': yuzde === 0 ? 'evet' : 'hayir',
          style: 'width:0%'
        })
      ]),
      Y.el('span', {
        class: 'ilerleme__metin',
        /* Deneme sınırsız olduğu için "başarı" ölçüsü ilk denemede
           doğru bulma oranıdır — anlamlı olan tek gösterge budur. */
        metin: ozet.cozulen + '/' + ozet.toplam + ' çözüldü' +
               (ozet.cozulen ? ' · %' + ozet.ilkDenemeYuzde + ' ilk denemede' : '')
      })
    ]);

    Y.bosalt(sahne).appendChild(
      Y.el('div', { class: 'sahne__ic' }, [
        ilerleme,
        Y.el('article', {
          class: 'kart kart--soru' + (soru.id !== sonCizilenSoru ? ' kart--girer' : ''),
          'aria-label': soru.no + '. soru'
        }, [
          kunye, serit, tarama, cevapAlani, geribildirim, eylemGrubu, eylemler
        ])
      ])
    );

    if (!Limit.veri.komsu(soru.id, 'onceki')) Y.sec('#dugmeOnceki').setAttribute('disabled', 'disabled');
    if (!Limit.veri.komsu(soru.id, 'sonraki')) Y.sec('#dugmeSonraki').setAttribute('disabled', 'disabled');

    sonCizilenSoru = soru.id;

    /* İlerleme çubuğunu bir sonraki karede hedefine sür. */
    requestAnimationFrame(function () {
      var dolu = Y.sec('#ilerlemeDolu', sahne);
      if (dolu) dolu.style.width = yuzde + '%';
    });

    kronoBaslat(soru, kayit.sureSn || 0);
    if (cozuldu) {
      kronoDurdur();
      geriBildirimBas(soru, kayit.secim, kayit.dogruMu, kayit.sureSn || 0, denemeler.length);
    } else if (denemeler.length) {
      geriBildirimBas(soru, kayit.secim, kayit.dogruMu, kayit.sureSn || 0, denemeler.length);
    }
  }

  /* ===========================================================
     Etkileşim
     =========================================================== */
  /* -----------------------------------------------------------
     Şık işaretleme — SINIRSIZ DENEME
     Yanlış şık yalnızca kendi içinde kırmızıya döner ve tekrar
     tıklanamaz; soru KİLİTLENMEZ ve doğru cevap AÇIK EDİLMEZ.
     Öğrenci doğruyu bulana kadar denemeye devam eder.
     ----------------------------------------------------------- */
  function sikSec(soru, harf) {
    var kayit = Limit.depo.ilerlemeAl(soru.id) || {};
    if (kayit.cozuldu) return;                       /* çözülmüş soruya dokunma */

    var denemeler = (kayit.denemeler || []).slice();
    if (denemeler.indexOf(harf) === -1) denemeler.push(harf);

    /* Anahtar yoksa dogruMu null kalır — uydurma değerlendirme yapılmaz. */
    var dogruMu = soru.dogru ? (harf === soru.dogru) : null;
    var cozuldu = dogruMu === true;

    if (cozuldu) kronoDurdur();

    Limit.depo.ilerlemeYaz(soru.id, {
      secim: harf,
      denemeler: denemeler,
      dogruMu: dogruMu,
      cozuldu: cozuldu,
      sureSn: gecenSn,
      tamamlandi: cozuldu
    });

    Y.secTum('.sik', sahne).forEach(function (d) {
      var h = d.getAttribute('data-harf');

      if (cozuldu) {
        /* Çözüldü: tüm şıklar kilitlenir, doğru olan yeşile döner. */
        d.setAttribute('disabled', 'disabled');
        d.setAttribute('aria-pressed', String(h === harf));
        if (h === soru.dogru) d.setAttribute('data-sonuc', 'dogru');
        else if (denemeler.indexOf(h) > -1) d.setAttribute('data-sonuc', 'yanlis');
        return;
      }

      /* Henüz çözülmedi: SADECE tıklanan şık işaretlenir.
         Diğerleri açık kalır — doğru cevaba dair hiçbir ipucu verilmez. */
      if (h !== harf) return;
      d.setAttribute('data-sonuc', dogruMu === null ? 'isaretli' : 'yanlis');
      d.setAttribute('aria-pressed', 'true');
      if (dogruMu === false) d.setAttribute('disabled', 'disabled');
    });

    geriBildirimBas(soru, harf, dogruMu, gecenSn, denemeler.length);
    ilerlemeTazele(soru);

    Limit.olay.yayinla('soru:cevaplandi', {
      soru: soru, secim: harf, dogruMu: dogruMu,
      sureSn: gecenSn, denemeNo: denemeler.length, cozuldu: cozuldu
    });
  }

  /* Cevap verilince sahne yeniden çizilmiyor; ilerleme şeridini
     yerinde güncelle. Aksi hâlde sol panel "1/4" derken üstteki
     çubuk "0/8"de kalıyordu. Genişlik geçişi CSS'te tanımlı,
     burada yalnızca hedef değer veriliyor. */
  function ilerlemeTazele(soru) {
    var sayfa = Limit.veri.soruSayfasi(soru.id);
    if (!sayfa) return;
    var ozet = Limit.veri.ozet(sayfa.brans);
    var yuzde = ozet.toplam ? Math.round((ozet.cozulen / ozet.toplam) * 100) : 0;

    var dolu = Y.sec('#ilerlemeDolu', sahne);
    if (dolu) {
      dolu.style.width = yuzde + '%';
      dolu.setAttribute('data-bos', yuzde === 0 ? 'evet' : 'hayir');
    }
    var metin = Y.sec('.ilerleme__metin', sahne);
    if (metin) {
      metin.textContent = ozet.cozulen + '/' + ozet.toplam + ' çözüldü' +
        (ozet.cozulen ? ' · %' + ozet.ilkDenemeYuzde + ' ilk denemede' : '');
    }
  }

  function geriBildirimBas(soru, secim, dogruMu, sureSn, denemeSayisi) {
    var kutu = Y.sec('#geribildirim', sahne);
    if (!kutu) return;
    Y.bosalt(kutu);

    var baslik, metin, durumAdi;

    if (dogruMu === null || dogruMu === undefined) {
      durumAdi = 'notr';
      baslik = secim + ' şıkkını işaretledin';
      metin = 'Bu sorunun anahtarı elimizde yok, otomatik değerlendirme yapılmıyor. ' +
              'Koça seçimini savunarak kontrol edebilirsin.';
    } else if (dogruMu) {
      durumAdi = 'dogru';
      baslik = 'Doğru!';
      metin = denemeSayisi > 1
        ? denemeSayisi + '. denemede buldun · süre ' + Y.sureBicim(sureSn) +
          '. Bu kez hangi adımı değiştirdin?'
        : 'İlk denemede · süre ' + Y.sureBicim(sureSn) +
          '. Yöntemini koça özetleyerek pekiştir.';
    } else {
      /* Doğru şık ASLA yazılmaz; öğrenci denemeye devam eder. */
      durumAdi = 'yanlis';
      baslik = secim + ' şıkkı olmadı';
      metin = 'Devam et — başka bir şık dene. Takıldıysan aşağıdan koçtan yardım isteyebilirsin.';
    }

    kutu.setAttribute('data-durum', durumAdi);
    kutu.appendChild(Y.el('div', {}, [
      Y.el('strong', { class: 'geribildirim__baslik', metin: baslik }),
      Y.el('span', { metin: metin })
    ]));
  }

  /* ===========================================================
     Dışa açık
     =========================================================== */
  Limit.sahne = {
    baglat: function () { sahne = Y.sec('#sahne'); },

    ciz: function () {
      var durum = Limit.depo.al();
      kronoDurdur();
      if (!durum.aktifSoruId) { karsilamaCiz(); return; }
      var soru = Limit.veri.soru(durum.aktifSoruId);
      if (soru) soruCiz(soru); else karsilamaCiz();
    },

    kronoDurdur: kronoDurdur,
    YAKINLIK_KADEMELERI: YAKINLIK_KADEMELERI
  };

})(window);
