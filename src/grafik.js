/* =============================================================
   grafik.js — İstatistik görselleştirmeleri
   -------------------------------------------------------------
   Chart.js'i marka diline sokar. Kutudan çıkan görünüm bilinçli
   olarak KULLANILMAZ: varsayılan ızgaralar, mavi paleti ve koyu
   tooltip'i tam da kaçındığımız "jenerik dashboard" görüntüsüdür.

   ÖLÇÜT KURALI
   Bu dosya ölçüt HESAPLAMAZ. Tüm sayılar src/istatistik.js'ten
   gelir; böylece özet kartı ile grafik asla çelişemez.
   "İlk denemede doğru" orada deneme_no=1 VE koc_yardimi=false
   olarak tanımlıdır ve burada da aynen o alan çizilir.

   RENK ANLAMI — tüm grafiklerde AYNI
     yeşil  → ilk denemede doğru (hakimiyet)
     gümüş  → sonradan çözüldü (tekrar ya da yardımla)
     kızıl  → yanlış / henüz çözülmedi
   Renk anlamı grafikten grafiğe DEĞİŞMEZ. Süre grafiği doğruluk
   ölçmediği için nötr gümüş kullanır.

   DAYANIKLILIK
   Chart.js CDN'den gelir. Ağ yoksa kütüphane yüklenmez; o durumda
   grafik yerine aynı veriyi taşıyan bir tablo çizilir. Panel
   hiçbir koşulda boş kalmaz.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;
  var Y = Limit.yrd;

  /* Token'lardan okunan marka renkleri — burada sabit renk üretilmez. */
  function jeton(ad, yedek) {
    var d = getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
    return d || yedek;
  }

  /* Bölge adları ve açıklamaları veri katmanından gelir. */
  var B = Limit.istatistik.BOLGELER;

  var RENK = null;
  function renkler() {
    if (RENK) return RENK;
    RENK = {
      hakimiyet: jeton('--dogru', '#0F8A5F'),
      sonradan:  jeton('--gumus-orta', '#999999'),
      yanlis:    jeton('--kizil-zemin', '#9C0000'),
      notr:      jeton('--gumus-koyu', '#525252'),
      cizgi:     jeton('--cizgi', '#E4E5E8'),
      metin:     jeton('--metin-orta', '#5A5C64'),
      murekkep:  jeton('--murekkep', '#24252A'),
      yuzey:     jeton('--yuzey', '#FFFFFF')
    };
    return RENK;
  }

  function hareketVar() {
    return !global.matchMedia ||
           !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function chartVarMi() { return typeof global.Chart !== 'undefined'; }

  /* ----------------------------------------------------------- */
  /* Chart.js ortak teması                                        */
  /* ----------------------------------------------------------- */
  function temaKur() {
    if (!chartVarMi()) return;
    var C = global.Chart, r = renkler();

    C.defaults.font.family =
      getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    C.defaults.font.size = 12;
    C.defaults.color = r.metin;
    C.defaults.animation = hareketVar() ? { duration: 320, easing: 'easeOutQuart' } : false;

    /* Varsayılan koyu tooltip yerine marka yüzeyi */
    C.defaults.plugins.tooltip.backgroundColor = r.yuzey;
    C.defaults.plugins.tooltip.titleColor = r.murekkep;
    C.defaults.plugins.tooltip.bodyColor = r.metin;
    C.defaults.plugins.tooltip.borderColor = r.cizgi;
    C.defaults.plugins.tooltip.borderWidth = 1;
    C.defaults.plugins.tooltip.cornerRadius = 6;
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.displayColors = true;
    C.defaults.plugins.tooltip.boxWidth = 10;
    C.defaults.plugins.tooltip.boxHeight = 10;

    /* Kendi göstergemizi (legend) HTML olarak çiziyoruz */
    C.defaults.plugins.legend.display = false;
  }

  /* Dolgunun üstüne yazılan sayı dolguya göre siyah ya da beyaz
     olmalı; tek bir gri her dolguda okunmuyordu (yeşil ve kızıl
     barda sayı neredeyse görünmezdi). Soluk dolgular beyaz zeminle
     harmanlanır, o yüzden alfa hesaba katılır. */
  function okunurRenk(zemin) {
    var m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(zemin || '').trim());
    if (!m) return renkler().metin;

    var alfa = m[2] ? parseInt(m[2], 16) / 255 : 1;
    function kanal(bas) {
      var d = parseInt(m[1].slice(bas, bas + 2), 16);
      return d * alfa + 255 * (1 - alfa);       /* beyaz zeminle harman */
    }
    var parlaklik = 0.299 * kanal(0) + 0.587 * kanal(2) + 0.114 * kanal(4);
    return parlaklik > 150 ? renkler().murekkep : '#FFFFFF';
  }

  /* Bar içine sayı yazan küçük eklenti — okuma renge bağlı kalmasın. */
  var sayiEklentisi = {
    id: 'ucSayilari',
    afterDatasetsDraw: function (grafik, arg, secenek) {
      if (!secenek || secenek.acik === false) return;
      var ctx = grafik.ctx;
      ctx.save();
      ctx.font = '600 11px ' + (global.Chart.defaults.font.family);
      ctx.textBaseline = 'middle';

      grafik.data.datasets.forEach(function (veriSeti, i) {
        var meta = grafik.getDatasetMeta(i);
        if (meta.hidden) return;
        var zemin = veriSeti.backgroundColor;

        meta.data.forEach(function (nokta, j) {
          var deger = veriSeti.data[j];
          if (!deger) return;                       /* 0 yazma */
          var yatay = grafik.options.indexAxis === 'y';
          ctx.textAlign = 'center';
          var x = yatay ? nokta.x - (nokta.width || 0) / 2 : nokta.x;
          var y = yatay ? nokta.y : nokta.y - 9;
          if (yatay && (nokta.width || 0) < 18) return;  /* sığmıyorsa yazma */
          ctx.fillStyle = okunurRenk(Array.isArray(zemin) ? zemin[j] : zemin);
          ctx.fillText(String(deger), x, y);
        });
      });
      ctx.restore();
    }
  };

  /* Neredeyse görünmez ızgara */
  function eksenIzgara(goster) {
    return {
      display: !!goster,
      color: renkler().cizgi,
      drawTicks: false
    };
  }

  /* ----------------------------------------------------------- */
  /* Yardımcılar                                                  */
  /* ----------------------------------------------------------- */
  function etiket(k) {
    return k.yeterliOrneklem ? k.konu : k.konu + ' (az veri)';
  }

  /* "Canlıların Temel Bileşenleri - III" gibi uzun adlar eksende
     soldan kırpılıyordu. Chart.js dizi verilen etiketi iki satıra
     yayar; ad KISALTILMAZ, yalnızca sarılır. */
  var ETIKET_SINIRI = 24;
  function etiketSatirlari(k) {
    var ad = etiket(k);
    if (ad.length <= ETIKET_SINIRI) return ad;

    var ust = '', alt = '';
    ad.split(' ').forEach(function (kelime) {
      if (!alt && (ust ? ust + ' ' + kelime : kelime).length <= ETIKET_SINIRI) {
        ust = ust ? ust + ' ' + kelime : kelime;
      } else {
        alt = alt ? alt + ' ' + kelime : kelime;
      }
    });
    return alt ? [ust, alt] : ust;
  }

  /* Yetersiz örneklemli konu soluk çizilir: sıfır gibi görünmesin,
     ama tam ağırlıkla da okunmasın. */
  function saydam(renk, k) {
    return k.yeterliOrneklem ? renk : renk + '66';
  }

  function gosterge(ogeler) {
    return Y.el('ul', { class: 'grafik-gosterge' }, ogeler.map(function (o) {
      return Y.el('li', {}, [
        Y.el('span', { class: 'grafik-gosterge__kutu', style: 'background:' + o.renk }),
        Y.el('span', { metin: o.ad })
      ]);
    }));
  }

  function ozetMetni(metin) {
    return Y.el('p', { class: 'grafik-ozet', metin: metin });
  }

  /* Chart.js yoksa aynı veriyi taşıyan tablo — hem yedek hem
     ekran okuyucu dostu. */
  function tablo(basliklar, satirlar) {
    return Y.el('div', { class: 'grafik-tablo-sarmal' }, [
      Y.el('table', { class: 'grafik-tablo' }, [
        Y.el('thead', {}, [
          Y.el('tr', {}, basliklar.map(function (b) {
            return Y.el('th', { metin: b });
          }))
        ]),
        Y.el('tbody', {}, satirlar.map(function (s) {
          return Y.el('tr', {}, s.map(function (h, i) {
            return Y.el(i === 0 ? 'th' : 'td', { metin: String(h) });
          }));
        }))
      ])
    ]);
  }

  function tuval(yukseklik) {
    return Y.el('div', {
      class: 'grafik-tuval',
      style: 'height:' + yukseklik + 'px'
    }, [Y.el('canvas')]);
  }

  function ciz(kap, yapilandirma) {
    var c = kap.querySelector('canvas');
    return new global.Chart(c.getContext('2d'), yapilandirma);
  }

  /* ===========================================================
     1) Konu bazında doğru ve yanlış — yatay yığılmış bar
     -----------------------------------------------------------
     İkili doğru/yanlış yerine ÜÇLÜ ayrım kullanılıyor: sınırsız
     denemede herkesin her sorusu sonunda "doğru" olacağı için
     ikili gösterim özet kartıyla çelişirdi.
     =========================================================== */
  function konuBarı(konular) {
    var r = renkler();
    var govde = Y.el('div', {});

    var toplamIlk = konular.reduce(function (t, k) { return t + k.ilkDenemede; }, 0);
    var toplamDenenen = konular.reduce(function (t, k) { return t + k.denenen; }, 0);

    govde.appendChild(ozetMetni(
      konular.length + ' konuda toplam ' + toplamDenenen + ' soru denendi; ' +
      toplamIlk + " tanesi ilk denemede yardımsız çözüldü. En yüksek oran: " +
      (konular.slice().sort(function (a, b) {
        return b.ilkDenemeYuzde - a.ilkDenemeYuzde;
      })[0] || {}).konu + '.'
    ));

    govde.appendChild(gosterge([
      { ad: 'İlk denemede doğru', renk: r.hakimiyet },
      { ad: 'Sonradan çözüldü', renk: r.sonradan },
      { ad: 'Henüz çözülmedi', renk: r.yanlis }
    ]));

    if (!chartVarMi()) {
      govde.appendChild(tablo(
        ['Konu', 'İlk denemede', 'Sonradan', 'Çözülmedi'],
        konular.map(function (k) {
          return [etiket(k), k.ilkDenemede, k.sonradanCozulen, k.cozulemeyen];
        })
      ));
      return govde;
    }

    var kap = tuval(Math.max(160, konular.length * 52 + 40));
    govde.appendChild(kap);

    setTimeout(function () {
      ciz(kap, {
        type: 'bar',
        data: {
          labels: konular.map(etiketSatirlari),
          datasets: [
            { label: 'İlk denemede doğru', data: konular.map(function (k) { return k.ilkDenemede; }),
              backgroundColor: konular.map(function (k) { return saydam(r.hakimiyet, k); }) },
            { label: 'Sonradan çözüldü', data: konular.map(function (k) { return k.sonradanCozulen; }),
              backgroundColor: konular.map(function (k) { return saydam(r.sonradan, k); }) },
            { label: 'Henüz çözülmedi', data: konular.map(function (k) { return k.cozulemeyen; }),
              backgroundColor: konular.map(function (k) { return saydam(r.yanlis, k); }) }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          borderRadius: 3,
          barPercentage: 0.62,
          scales: {
            x: { stacked: true, beginAtZero: true, grid: eksenIzgara(true),
                 border: { display: false },
                 ticks: { precision: 0, padding: 6 } },
            y: { stacked: true, grid: eksenIzgara(false),
                 border: { display: false },
                 /* Uzun konu adları sol kenardan kırpılıyordu:
                    eksene pay bırakılıp punto bir tık küçültüldü. */
                 ticks: { padding: 10, autoSkip: false, font: { size: 11 } } }
          },
          layout: { padding: { left: 6, right: 8 } },
          plugins: {
            ucSayilari: { acik: true },
            tooltip: {
              callbacks: {
                label: function (b) { return b.dataset.label + ': ' + b.raw + ' soru'; }
              }
            }
          }
        },
        plugins: [sayiEklentisi]
      });
    }, 0);

    return govde;
  }

  /* ===========================================================
     2) Yanlışların konu dağılımı — halka
     -----------------------------------------------------------
     Dilimlerin hepsi "yanlış" olduğu için renk anlamı korunur:
     tek bir kızıl rampa kullanılır, konular açıklıkla ayrışır.
     Böylece "kızıl = yanlış" kodu bozulmaz.
     =========================================================== */
  function yanlisHalka(konular) {
    var r = renkler();
    var veri = konular.filter(function (k) { return k.yanlisDeneme > 0; })
                      .sort(function (a, b) { return b.yanlisDeneme - a.yanlisDeneme; });
    var govde = Y.el('div', {});

    if (!veri.length) {
      govde.appendChild(ozetMetni('Henüz yanlış işaretlemen yok — bu grafiği görebilmek için biraz daha soru çözmen gerekiyor.'));
      return govde;
    }

    var toplam = veri.reduce(function (t, k) { return t + k.yanlisDeneme; }, 0);
    var enUst = veri[0];

    /* Türkçede yüzde işareti sayının ÖNÜNE gelir: %75, "75%" değil. */
    govde.appendChild(ozetMetni(
      'Toplam ' + toplam + ' yanlış işaretlemenin %' +
      Math.round(100 * enUst.yanlisDeneme / toplam) + "'i " + enUst.konu +
      ' konusunda. Buradan başlamak en çok kazandırır.'
    ));

    /* Kızıl rampa: en çok yanlış en koyu. Ayrım renkten değil
       açıklıktan ve etiketten geliyor. */
    var tonlar = veri.map(function (k, i) {
      var oran = veri.length === 1 ? 0 : i / (veri.length - 1);
      var acilma = Math.round(oran * 145);
      return 'rgb(' + (156 + acilma * 0.62) + ',' + (acilma * 0.72) + ',' + (acilma * 0.72) + ')';
    });

    govde.appendChild(gosterge(veri.map(function (k, i) {
      return { ad: etiket(k) + ' · ' + k.yanlisDeneme, renk: tonlar[i] };
    })));

    if (!chartVarMi()) {
      govde.appendChild(tablo(['Konu', 'Yanlış işaretleme'],
        veri.map(function (k) { return [etiket(k), k.yanlisDeneme]; })));
      return govde;
    }

    var kap = tuval(240);
    govde.appendChild(kap);

    setTimeout(function () {
      ciz(kap, {
        type: 'doughnut',
        data: {
          /* Halkada etiket yalnızca tooltip'te görünür; sarmak
             yerine tek satır kalsın. */
          labels: veri.map(etiket),
          datasets: [{
            data: veri.map(function (k) { return k.yanlisDeneme; }),
            backgroundColor: tonlar,
            borderColor: r.yuzey,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            ucSayilari: { acik: false },
            tooltip: {
              callbacks: {
                label: function (b) {
                  return b.label + ': ' + b.raw + ' yanlış (%' +
                         Math.round(100 * b.raw / toplam) + ')';
                }
              }
            }
          }
        }
      });
    }, 0);

    return govde;
  }

  /* ===========================================================
     3) Konu bazında ortalama çözüm süresi — bar
     -----------------------------------------------------------
     Süre doğruluk ölçmez; bu yüzden nötr gümüş. Kızıl/yeşil
     kullanmak "yavaş = yanlış" gibi yanlış bir anlam üretirdi.
     =========================================================== */
  function sureBarı(konular) {
    var r = renkler();
    var veri = konular.filter(function (k) { return k.ortalamaSure !== null; })
                      .sort(function (a, b) { return b.ortalamaSure - a.ortalamaSure; });
    var govde = Y.el('div', {});

    if (!veri.length) {
      govde.appendChild(ozetMetni('Süre ortalaması için henüz çözülmüş soru yok.'));
      return govde;
    }

    var enYavas = veri[0], enHizli = veri[veri.length - 1];
    /* Tek konu varsa "en yavaş X, en hızlı X" diye aynı adı iki kez
       yazmak bozuk görünüyordu; kıyas yoksa kıyas cümlesi kurulmaz. */
    govde.appendChild(ozetMetni(
      (veri.length === 1
        ? 'Şimdilik tek konuda süre ölçümü var: ' + enYavas.konu +
          ' (' + enYavas.ortalamaSure + ' sn). '
        : 'En çok vakit alan konu ' + enYavas.konu + ' (' + enYavas.ortalamaSure + ' sn), ' +
          'en hızlı çözdüğün konu ' + enHizli.konu + ' (' + enHizli.ortalamaSure + ' sn). ') +
      'Süre tek başına iyi ya da kötü değildir — bir sonraki grafik hızı isabetle birlikte okur.'
    ));

    govde.appendChild(gosterge([
      { ad: 'Doğruyu bulana kadar geçen ortalama süre (sn)', renk: r.notr }
    ]));

    if (!chartVarMi()) {
      govde.appendChild(tablo(['Konu', 'Ortalama süre (sn)'],
        veri.map(function (k) { return [etiket(k), k.ortalamaSure]; })));
      return govde;
    }

    var kap = tuval(Math.max(180, veri.length * 50 + 50));
    govde.appendChild(kap);

    setTimeout(function () {
      ciz(kap, {
        type: 'bar',
        data: {
          labels: veri.map(etiketSatirlari),
          datasets: [{
            label: 'Ortalama süre',
            data: veri.map(function (k) { return k.ortalamaSure; }),
            backgroundColor: veri.map(function (k) { return saydam(r.notr, k); })
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          borderRadius: 3,
          barPercentage: 0.55,
          scales: {
            x: { beginAtZero: true, grid: eksenIzgara(true), border: { display: false },
                 ticks: { padding: 6, callback: function (d) { return d + ' sn'; } } },
            y: { grid: eksenIzgara(false), border: { display: false },
                 ticks: { padding: 10, autoSkip: false, font: { size: 11 } } }
          },
          layout: { padding: { left: 6, right: 8 } },
          plugins: {
            ucSayilari: { acik: true },
            tooltip: {
              callbacks: { label: function (b) { return b.raw + ' saniye'; } }
            }
          }
        },
        plugins: [sayiEklentisi]
      });
    }, 0);

    return govde;
  }

  /* ===========================================================
     4) Hız–isabet haritası — dağılım (scatter)
     -----------------------------------------------------------
     Panelin imza analizi. Süre ile isabet TEK BAŞLARINA yanıltıcı:
     hızlı olmak iyi değildir eğer isabet düşükse, yavaş olmak kötü
     değildir eğer doğruyu buluyorsan. İkisi birlikte okunur.

     ERİŞİLEBİLİRLİK
     Bölge adları renkten okunmaz: dört bölge hem grafiğin içine
     yazıyla çizilir hem de altta metin listesi olarak tekrarlanır.
     Renk yalnızca panelin geri kalanındaki anlamı taşır
     (yeşil = ilk denemede doğru, kızıl = tutmuyor); hız bilgisi
     renkte DEĞİL konumdadır. Örneklemi zayıf konu hem soluk hem
     üçgen çizilir — biçim de ayırt eder.
     =========================================================== */
  function bolgeEklentisi(hi) {
    return {
      id: 'bolgeler',
      beforeDatasetsDraw: function (grafik) {
        var ctx = grafik.ctx, r = renkler();
        var ax = grafik.scales.x, ay = grafik.scales.y;
        var ex = ax.getPixelForValue(hi.esikSure);
        var ey = ay.getPixelForValue(hi.esikIsabet);
        var sol = ax.left, sag = ax.right, ust = ay.top, alt = ay.bottom;

        /* Kırpma: eşik grafiğin dışına taşarsa çizgi kenarda kalsın */
        ex = Math.max(sol, Math.min(sag, ex));
        ey = Math.max(ust, Math.min(alt, ey));

        ctx.save();

        /* İsabetli yarı (üst) çok hafif yeşile, isabetsiz yarı (alt)
           çok hafif kızıla çalar. Doygunluk bilinçli olarak düşük:
           bölge okunuşu YAZIDAN gelmeli, zeminden değil. */
        ctx.fillStyle = r.hakimiyet + '0D';
        ctx.fillRect(sol, ust, sag - sol, ey - ust);
        ctx.fillStyle = r.yanlis + '0D';
        ctx.fillRect(sol, ey, sag - sol, alt - ey);

        /* Eşik çizgileri */
        ctx.strokeStyle = r.cizgi;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ex, ust); ctx.lineTo(ex, alt);
        ctx.moveTo(sol, ey); ctx.lineTo(sag, ey);
        ctx.stroke();
        ctx.setLineDash([]);

        /* Bölge adları — köşelere, soluk ama okunur */
        ctx.font = '600 11px ' + global.Chart.defaults.font.family;
        ctx.fillStyle = r.metin + 'B3';
        var pay = 8;
        function yaz(metin, x, y, hiza, temel) {
          ctx.textAlign = hiza; ctx.textBaseline = temel;
          ctx.fillText(metin, x, y);
        }
        /* x ekseni saniye: SOL = hızlı, SAĞ = yavaş */
        yaz(B.guclu.ad,  sol + pay, ust + pay, 'left',  'top');
        yaz(B.yavas.ad,  sag - pay, ust + pay, 'right', 'top');
        yaz(B.acele.ad,  sol + pay, alt - pay, 'left',  'bottom');
        yaz(B.kavram.ad, sag - pay, alt - pay, 'right', 'bottom');

        ctx.restore();
      }
    };
  }

  /* Bölgelerin yazılı karşılığı. Grafik olmasa da, renk görülmese de
     analiz burada tam olarak okunur. */
  function bolgeListesi(hi) {
    var kova = {};
    hi.noktalar.forEach(function (n) {
      (kova[n.bolge] || (kova[n.bolge] = [])).push(n);
    });

    var sira = ['guclu', 'yavas', 'acele', 'kavram'];
    return Y.el('ul', { class: 'bolge-listesi' },
      sira.filter(function (a) { return kova[a]; }).map(function (a) {
        return Y.el('li', { class: 'bolge-listesi__oge' }, [
          Y.el('span', { class: 'bolge-listesi__ad', metin: B[a].ad }),
          Y.el('span', {
            class: 'bolge-listesi__konular',
            metin: kova[a].map(function (n) {
              return n.konu + (n.yeterliOrneklem ? '' : ' (az veri)');
            }).join(' · ')
          }),
          Y.el('span', { class: 'bolge-listesi__not', metin: B[a].aciklama })
        ]);
      })
    );
  }

  function hizIsabetHarita(hi) {
    var r = renkler();
    var govde = Y.el('div', {});

    if (!hi.yeterli) {
      govde.appendChild(ozetMetni(
        'Harita için en az iki farklı konuda çözülmüş soru gerekiyor. ' +
        'Birkaç konu daha denedikten sonra burada nerede acele ettiğin, ' +
        'nerede tempoya ihtiyacın olduğu görünecek.'
      ));
      return govde;
    }

    /* Eşiğin nereden geldiği açıkça yazılır; öğrenci "%50 sınırını kim
       koydu, bu saniye nereden çıktı" diye sormasın. */
    var esikCumlesi = hi.yontem === 'ortanca'
      ? 'Hız sınırı ' + hi.esikSure + ' sn — bu senin kendi konu ortancan, ' +
        'kimseyle kıyaslanmıyorsun.'
      : 'Hız sınırı ' + hi.esikSure + ' sn (soru başına yaygın hedef tempo); ' +
        'yeterli veri birikince kendi ortancana göre yeniden çizilecek.';

    var kovalar = {};
    hi.noktalar.forEach(function (n) { kovalar[n.bolge] = (kovalar[n.bolge] || 0) + 1; });
    var enKalabalik = Object.keys(kovalar).sort(function (a, b) {
      return kovalar[b] - kovalar[a];
    })[0];

    govde.appendChild(ozetMetni(
      hi.noktalar.length + ' konunun ' + kovalar[enKalabalik] + ' tanesi "' +
      B[enKalabalik].ad + '" bölgesinde. ' + B[enKalabalik].aciklama + ' ' +
      esikCumlesi + ' İsabet sınırı %' + hi.esikIsabet + '.'
    ));

    govde.appendChild(gosterge([
      { ad: 'İsabet %' + hi.esikIsabet + ' ve üzeri', renk: r.hakimiyet },
      { ad: 'İsabet %' + hi.esikIsabet + ' altında', renk: r.yanlis }
    ]));

    if (!chartVarMi()) {
      govde.appendChild(tablo(
        ['Konu', 'Ort. süre', 'İlk denemede', 'Bölge'],
        hi.noktalar.slice().sort(function (a, b) { return a.sure - b.sure; })
          .map(function (n) {
            return [n.konu + (n.yeterliOrneklem ? '' : ' (az veri)'),
                    n.sure + ' sn', '%' + n.isabet, n.bolgeAdi];
          })
      ));
      govde.appendChild(bolgeListesi(hi));
      return govde;
    }

    var kap = tuval(320);
    govde.appendChild(kap);
    govde.appendChild(bolgeListesi(hi));

    var enYavas = hi.noktalar.reduce(function (m, n) {
      return Math.max(m, n.sure);
    }, hi.esikSure);

    setTimeout(function () {
      ciz(kap, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Konular',
            data: hi.noktalar.map(function (n) {
              return { x: n.sure, y: n.isabet, n: n };
            }),
            backgroundColor: hi.noktalar.map(function (n) {
              var temel = n.isabetli ? r.hakimiyet : r.yanlis;
              return n.yeterliOrneklem ? temel : temel + '59';
            }),
            borderColor: r.yuzey,
            borderWidth: 2,
            pointRadius: hi.noktalar.map(function (n) {
              return n.yeterliOrneklem ? 9 : 7;
            }),
            pointHoverRadius: hi.noktalar.map(function (n) {
              return n.yeterliOrneklem ? 11 : 9;
            }),
            pointStyle: hi.noktalar.map(function (n) {
              return n.yeterliOrneklem ? 'circle' : 'triangle';
            }),
            /* %0 ve %100'deki konular tam eksen üstüne düşer; kırpma
               açık kalırsa noktanın yarısı kesilir. */
            clip: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 14, right: 12, bottom: 14, left: 4 } },
          scales: {
            x: {
              min: 0,
              max: Math.ceil((enYavas * 1.18) / 10) * 10,
              grid: eksenIzgara(true),
              border: { display: false },
              title: { display: true, text: 'Doğruyu bulana kadar geçen ortalama süre',
                       color: r.metin, font: { size: 11 } },
              ticks: { padding: 6, callback: function (d) { return d + ' sn'; } }
            },
            y: {
              min: 0, max: 100,
              grid: eksenIzgara(true),
              border: { display: false },
              title: { display: true, text: 'İlk denemede doğru',
                       color: r.metin, font: { size: 11 } },
              ticks: { stepSize: 25, padding: 6,
                       callback: function (d) { return '%' + d; } }
            }
          },
          plugins: {
            ucSayilari: { acik: false },
            tooltip: {
              callbacks: {
                title: function (b) {
                  var n = b[0].raw.n;
                  return n.konu + (n.yeterliOrneklem ? '' : ' · az veri');
                },
                label: function (b) {
                  var n = b.raw.n;
                  return [
                    'Ortalama süre: ' + n.sure + ' sn',
                    'İlk denemede doğru: %' + n.isabet,
                    'Bölge: ' + n.bolgeAdi,
                    n.denenen + ' soru denendi'
                  ];
                }
              }
            }
          }
        },
        plugins: [bolgeEklentisi(hi)]
      });
    }, 0);

    return govde;
  }

  /* ===========================================================
     5) Zaman içinde gelişim — çift eksenli çizgi
     -----------------------------------------------------------
     Sol eksen isabet (%), sağ eksen süre (sn). İki ölçü aynı
     eksende olamaz: biri yüzde, diğeri saniye.

     Süre çizgisi kesikli ve nötr gümüş — süre doğruluk ölçmez,
     yeşil/kızıl kullanmak "yavaş = yanlış" anlamı üretirdi.

     Her soru İLK denendiği güne yazılır (bkz. istatistik.gelisim);
     böylece günlerin toplamı özet kartıyla birebir tutar.
     =========================================================== */
  function gelisimCizgi(gelisim) {
    var r = renkler();
    var govde = Y.el('div', {});

    if (!gelisim.yeterli) {
      govde.appendChild(ozetMetni(
        gelisim.gunSayisi === 1
          ? 'Trend için henüz yeterli veri yok: şimdilik tek bir güne ait çalışma var. ' +
            'Farklı bir günde birkaç soru daha çözünce gelişimin burada çizilmeye başlayacak.'
          : 'Trend için henüz yeterli veri yok. Birkaç gün soru çözdükçe ' +
            'isabetin ve sürenin nasıl değiştiği burada görünecek.'
      ));
      return govde;
    }

    var g = gelisim.gunler;
    var ilk = gelisim.ilkGun, son = gelisim.sonGun;
    var fark = son.ilkDenemeYuzde - ilk.ilkDenemeYuzde;

    /* Yön cümlesi cezalandırmaz: düşüşte de "zorlaştırdın" ihtimalini
       açık bırakır, çünkü soru zorluğu günden güne değişir. */
    var yon;
    if (fark > 4) {
      yon = 'İlk denemede doğru oranın ' + ilk.etiket + ' gününde %' +
            ilk.ilkDenemeYuzde + ' iken ' + son.etiket + ' gününde %' +
            son.ilkDenemeYuzde + ' — yukarı gidiyor.';
    } else if (fark < -4) {
      yon = 'İlk denemede doğru oranın ' + ilk.etiket + ' gününde %' +
            ilk.ilkDenemeYuzde + ' iken ' + son.etiket + ' gününde %' +
            son.ilkDenemeYuzde + '. Düşüş her zaman gerileme demek değil; ' +
            'daha zor konulara geçmiş olabilirsin.';
    } else {
      yon = 'İlk denemede doğru oranın ' + gelisim.gunSayisi +
            ' gün boyunca %' + ilk.ilkDenemeYuzde + ' civarında sabit kaldı.';
    }

    /* Günde bir iki soru çözülmüşse oran %0 ile %100 arasında
       zıplar; çizgi gerçekte olmayan bir dalgalanma gösterir.
       Bunu gizlemek yerine söylüyoruz. */
    var azVeriGun = g.filter(function (x) { return x.azVeri; }).length;
    if (azVeriGun === gelisim.gunSayisi) {
      yon += ' Günlerin tamamında ' + Limit.istatistik.KONU_ESIGI +
             ' sorudan az çalışma var: tek tek günlerin oranından çok genel yöne bak, ' +
             'tek bir soru oranı uçtan uca savurabiliyor.';
    } else if (azVeriGun) {
      yon += ' ' + gelisim.gunSayisi + ' günün ' + azVeriGun + "'inde " +
             Limit.istatistik.KONU_ESIGI + ' sorudan az çalışma var; ' +
             'o günler üçgenle işaretli ve tek bir soruyla savrulabilir.';
    }

    govde.appendChild(ozetMetni(yon));

    var gostergeler = [{ ad: 'İlk denemede doğru (%)', renk: r.hakimiyet }];
    if (gelisim.sureVarMi) {
      gostergeler.push({ ad: 'Ortalama süre (sn)', renk: r.notr });
    }
    govde.appendChild(gosterge(gostergeler));

    if (!chartVarMi()) {
      govde.appendChild(tablo(
        ['Gün', 'Denenen soru', 'İlk denemede', 'Ort. süre'],
        g.map(function (x) {
          return [x.etiket + (x.azVeri ? ' (az veri)' : ''), x.denenen,
                  '%' + x.ilkDenemeYuzde,
                  x.ortalamaSure === null ? '—' : x.ortalamaSure + ' sn'];
        })
      ));
      return govde;
    }

    var kap = tuval(280);
    govde.appendChild(kap);

    var veriSetleri = [{
      label: 'İlk denemede doğru',
      data: g.map(function (x) { return x.ilkDenemeYuzde; }),
      yAxisID: 'yIsabet',
      borderColor: r.hakimiyet,
      backgroundColor: r.hakimiyet,
      borderWidth: 2,
      /* Yumuşatma YOK. Eğri, iki gün arasında gerçekte ölçülmemiş
         ara değerler ima ediyordu; günler arası düz çizilir. */
      tension: 0,
      pointRadius: g.map(function (x) { return x.azVeri ? 5 : 6; }),
      pointHoverRadius: 8,
      /* Az veri günü: içi boş üçgen. Hem biçim hem doluluk ayırır,
         renk körü de dolu/boş farkını görür. */
      pointStyle: g.map(function (x) { return x.azVeri ? 'triangle' : 'circle'; }),
      pointBackgroundColor: g.map(function (x) {
        return x.azVeri ? r.yuzey : r.hakimiyet;
      }),
      pointBorderColor: r.hakimiyet,
      pointBorderWidth: 2,
      /* %0 ve %100 tam eksen üstündedir; kırpılmasın. */
      clip: false
    }];

    if (gelisim.sureVarMi) {
      veriSetleri.push({
        label: 'Ortalama süre',
        data: g.map(function (x) { return x.ortalamaSure; }),
        yAxisID: 'ySure',
        borderColor: r.notr,
        backgroundColor: r.notr,
        borderWidth: 2,
        borderDash: [5, 4],
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBorderColor: r.yuzey,
        pointBorderWidth: 2,
        spanGaps: true,
        clip: false
      });
    }

    setTimeout(function () {
      ciz(kap, {
        type: 'line',
        data: { labels: g.map(function (x) { return x.etiket; }), datasets: veriSetleri },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          layout: { padding: { top: 14, right: 10, bottom: 8, left: 4 } },
          scales: {
            x: { grid: eksenIzgara(false), border: { display: false },
                 ticks: { padding: 6, font: { size: 11 } } },
            yIsabet: {
              position: 'left', min: 0, max: 100,
              grid: eksenIzgara(true), border: { display: false },
              title: { display: true, text: 'İlk denemede doğru',
                       color: r.metin, font: { size: 11 } },
              ticks: { stepSize: 25, padding: 6,
                       callback: function (d) { return '%' + d; } }
            },
            ySure: {
              display: gelisim.sureVarMi,
              position: 'right', beginAtZero: true,
              grid: { display: false }, border: { display: false },
              title: { display: true, text: 'Ortalama süre',
                       color: r.metin, font: { size: 11 } },
              ticks: { padding: 6, callback: function (d) { return d + ' sn'; } }
            }
          },
          plugins: {
            ucSayilari: { acik: false },
            tooltip: {
              callbacks: {
                title: function (b) {
                  var x = g[b[0].dataIndex];
                  return x.etiket + ' · ' + x.denenen + ' soru' +
                         (x.azVeri ? ' (az veri)' : '');
                },
                label: function (b) {
                  return b.dataset.yAxisID === 'ySure'
                    ? 'Ortalama süre: ' + b.raw + ' sn'
                    : 'İlk denemede doğru: %' + b.raw;
                }
              }
            }
          }
        }
      });
    }, 0);

    return govde;
  }

  /* ----------------------------------------------------------- */
  Limit.grafik = {
    temaKur: temaKur,
    chartVarMi: chartVarMi,
    konuBari: konuBarı,
    yanlisHalka: yanlisHalka,
    sureBari: sureBarı,
    hizIsabetHarita: hizIsabetHarita,
    gelisimCizgi: gelisimCizgi
  };

})(window);
