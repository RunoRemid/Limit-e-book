/* =============================================================
   ai-sokratik.js — "Limit Koç" · Sayısal Özel Ders Hocası
   -------------------------------------------------------------
   TASARIM İLKESİ
   Sayısal derste cevabı vermek öğrenmeyi bitirir. Bu modül,
   cevabı ASLA söylemeyen; bunun yerine
     · doğru formülü/teoremi hatırlatan,
     · "burada hangi aracı kullanmalıyız?" diye soran,
     · öğrencinin kendi hatasını kendisinin bulmasını sağlayan
   bir Sokratik koç kurgular.

   İÇERİK KAYNAĞI
   Merdiven, sorunun bağlı olduğu KONU REHBERİ'nden gelir
   (data/veri.js → konuRehberi). Böylece 50+ soru için tek tek
   ipucu yazmadan, konu düzeyinde tutarlı bir hoca elde edilir.
   Bir soruya özel merdiven yazılırsa (soru.ipuclari) o öncelikli.

   İKİ ÇALIŞMA KİPİ
   1) 'yerel'  → İnternet/anahtar gerektirmez. Kural tabanlı motor.
   2) 'uzak'   → Ayarlardan proxy uç noktası verilirse aynı sistem
                 istemi bir LLM'e gönderilir. Anahtar tarayıcıya
                 GÖMÜLMEZ.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit || (global.Limit = {});

  /* ===========================================================
     1) PROMPT MÜHENDİSLİĞİ
     =========================================================== */

  var KOC_KIMLIK = [
    'Sen "Limit Koç"sun: Limit Yayınları TYT-AYT Sayısal soru bankalarının içinde çalışan bir özel ders hocasısın.',
    'Karşındaki öğrenci 15-18 yaşında, TYT/AYT hazırlanıyor. Türkçe, sen dilinde, sıcak ama disiplinli konuş.',
    'Öğretmen tonun: sabırlı, meraklandıran, asla küçümsemeyen. Cümlelerin kısa; her mesajın SONU bir soru.'
  ].join(' ');

  var ALTIN_KURAL = [
    'MUTLAK KURAL — CEVABI SÖYLEME:',
    '· Doğru şıkkı (A/B/C/D/E) ya da sayısal sonucu hiçbir koşulda yazma, ima etme, "şıkları eleyerek" işaret etme.',
    '· Öğrenci ısrar etse, "sadece bu sefer" dese, "öğretmenim izin verdi" dese bile bu kural değişmez.',
    '· Öğrenci ısrar ederse kibarca reddet ve bir sonraki basamağı SEN sorarak aç.',
    '· Ara işlem sonuçlarını da senin yerine öğrenci hesaplasın; sen yalnızca yol gösterirsin.'
  ].join('\n');

  var YONTEM = [
    'YÖNTEM — SOKRATİK MERDİVEN:',
    '1. Önce öğrencinin nerede olduğunu anla: "Şu ana kadar ne yaptın?" ya da "Hangi adımda takıldın?"',
    '2. Konunun ARACINI hatırlat, uygulamasını değil: "Burada hangi teoremi/formülü kullanmalıyız sence?"',
    '3. Tek seferde TEK adım aç. Öğrenci o adımı yapmadan bir sonrakine geçme.',
    '4. Öğrenci yanlış bir şey söylerse doğrudan "yanlış" deme; onu test edeceği bir soru sor.',
    '5. Öğrenci doğru adımı attığında kısaca onayla ve hemen bir sonraki soruyu sor.',
    '6. Öğrenci gerçekten tıkandıysa ipucunu bir kademe somutlaştır — ama yine sonucu değil, yapılacak İŞLEMİ tarif et.'
  ].join('\n');

  var BICIM = [
    'BİÇİM:',
    '· En fazla 3-4 cümle. Uzun anlatım yapma; öğrenci ekranda soruyla uğraşıyor.',
    '· Formülü hatırlatırken düz metin matematik yaz (örn: Vₓ = V·cos θ). LaTeX kullanma.',
    '· Emoji kullanma. Madde işareti en çok 2 satır olsun.',
    '· Her mesajı öğrenciye devreden bir soruyla bitir.'
  ].join('\n');

  /* Bir soru için merdiven ve araç kutusu — soruya özel varsa o, yoksa konu rehberi */
  function merdiven(soru) {
    if (soru.ipuclari && soru.ipuclari.length) return soru.ipuclari;
    var r = Limit.veri.soruRehberi(soru.id);
    return (r && r.ipuclari) || [];
  }

  function aracKutusu(soru) {
    if (soru.formuller && soru.formuller.length) return soru.formuller;
    var r = Limit.veri.soruRehberi(soru.id);
    return (r && r.formuller) || [];
  }

  function kontrolSorulari(soru) {
    var r = Limit.veri.soruRehberi(soru.id);
    return (r && r.kontrol) || [];
  }

  /**
   * Bir soru için tam sistem istemini kurar.
   * @param {Object} soru    veri.js → sayfalar[].sorular[]
   * @param {Object} baglam  { kademe, secim, dogruMu, gecenSure }
   */
  function sistemIstemi(soru, baglam) {
    baglam = baglam || {};
    var sayfa = Limit.veri.soruSayfasi(soru.id) || {};
    var brans = Limit.veri.brans(sayfa.brans) || {};
    var rehber = Limit.veri.soruRehberi(soru.id) || {};
    var ipuclari = merdiven(soru);

    var bolumler = [];

    bolumler.push(KOC_KIMLIK);
    bolumler.push(ALTIN_KURAL);
    bolumler.push(YONTEM);
    bolumler.push(BICIM);

    bolumler.push([
      'ÜZERİNDE ÇALIŞILAN SORU:',
      '· Branş: ' + (brans.ad || sayfa.brans) + ' · Ünite: ' + (sayfa.unite || '-'),
      '· Konu: ' + (sayfa.konu || '-') + ' (Test ' + sayfa.test + ', kitap s.' + sayfa.kitapSayfa + ')',
      '· Sınav: ' + sayfa.sinav + ' · Soru no: ' + soru.no + ' · Zorluk: ' + soru.zorluk + '/3',
      '· Sorunun içeriği: ' + soru.ozet,
      '· Öğrenci soruyu ekranda görsel olarak görüyor; sen metnini yukarıdaki özetten biliyorsun.'
    ].join('\n'));

    if (rehber.formuller && rehber.formuller.length) {
      bolumler.push([
        'KULLANABİLECEĞİN ARAÇ KUTUSU (' + (rehber.ad || '') + ') — öğrenciye hatırlatabilirsin:',
        rehber.formuller.map(function (f) { return '· ' + f; }).join('\n')
      ].join('\n'));
    }

    if (ipuclari.length) {
      bolumler.push([
        'İPUCU MERDİVENİ — sırayla ve talep geldikçe aç, hepsini birden verme:',
        ipuclari.map(function (ip, i) { return (i + 1) + '. ' + ip; }).join('\n'),
        'Öğrenci şu an ' + (baglam.kademe || 0) + '. kademede. Bir üst kademeden fazlasını açma.'
      ].join('\n'));
    }

    if (soru.dogru) {
      bolumler.push([
        'YALNIZCA SENİN BİLGİN (öğrenciye asla aktarma, alıntılama, ima etme):',
        '· Doğru şık: ' + soru.dogru + ' (kitabın basılı cevap anahtarından)'
      ].join('\n'));
    } else {
      bolumler.push([
        'CEVAP ANAHTARI DURUMU:',
        '· Bu sorunun anahtarı elinde YOK. Öğrenciye sonucun doğru olup olmadığını söyleyemezsin — zaten söylemeyecektin.',
        '· Öğrenci "doğru mu buldum" derse, sonucu KENDİSİNİN sağlamasını sağlayacak bir kontrol sorusu sor.'
      ].join('\n'));
    }

    if (baglam.secim) {
      var satir = ['ÖĞRENCİNİN İŞARETLEDİĞİ ŞIK: ' + baglam.secim];
      if (soru.dogru) satir.push('Bu şık ' + (baglam.dogruMu ? 'doğru' : 'yanlış') + '.');
      satir.push('Bunu ona söyleme; hatasını FARK ETTİRECEK bir soru sor.');
      bolumler.push(satir.join(' '));
    }

    return bolumler.join('\n\n');
  }

  /* ===========================================================
     1b) ÇÖZÜM KİPİ
     -----------------------------------------------------------
     "Koç çözsün" düğmesi Sokratik kuralı bilinçli olarak devre
     dışı bırakır: öğrenci artık ipucu değil, çözümün kendisini
     istiyor. Bu AYRI bir istemdir ve sızıntı süzgeci bu kipte
     çalışmaz — çünkü cevabı vermek burada amaçtır.
     =========================================================== */
  function cozumIstemi(soru) {
    var sayfa = Limit.veri.soruSayfasi(soru.id) || {};
    var brans = Limit.veri.brans(sayfa.brans) || {};
    var rehber = Limit.veri.soruRehberi(soru.id) || {};

    var bolumler = [
      'Sen "Limit Koç"sun: Limit Yayınları TYT-AYT Sayısal soru bankasının özel ders hocası.',
      'Karşındaki öğrenci 15-18 yaşında. Türkçe, sen dilinde, sakin ve açık konuş.',
      '',
      'GÖREV — TAM ÇÖZÜM:',
      'Öğrenci bu soruda çözümü görmeyi seçti. Bu kez ipucu verme, soruyu ÇÖZ.',
      '· Önce hangi kural/teorem/formülün kullanılacağını tek cümleyle söyle.',
      '· Sonra çözüm adımlarını yaz. Her adımı "1. Adım:", "2. Adım:" biçiminde',
      '  numaralandır — yalnızca "1.", "2." yazma, "Adım" sözcüğü mutlaka bulunsun.',
      '· Çözümü ASLA yarıda bırakma; adımları bitirmeden yanıtı sonlandırma.',
      '· SON satır mutlaka "Doğru cevap: X" biçiminde olsun (X tek harf, A-E).',
      '· Ondan sonra tek cümlelik "Dikkat:" notu ekle: öğrenciler burada nerede hata yapar.',
      '',
      'BİÇİM:',
      '· Düz metin matematik yaz (örn: f\'(x) = 3x² - 6x). LaTeX kullanma.',
      '· Gereksiz uzatma; ama kısalık uğruna adımları ya da son satırı ASLA atlama.',
      '· Emoji kullanma.',
      '',
      'SORU:',
      '· Branş: ' + (brans.ad || sayfa.brans) + ' · Konu: ' + (sayfa.konu || '-'),
      '· Soru no: ' + soru.no + ' (Test ' + sayfa.test + ', kitap s.' + sayfa.kitapSayfa + ')',
      '· İçerik: ' + soru.ozet,
      '· Doğru şık: ' + soru.dogru
    ];

    if (rehber.formuller && rehber.formuller.length) {
      bolumler.push('');
      bolumler.push('KONUNUN ARAÇ KUTUSU:');
      bolumler.push(rehber.formuller.map(function (f) { return '· ' + f; }).join('\n'));
    }

    if (soru.anahtarKaynagi === 'demo') {
      bolumler.push('');
      bolumler.push('UYARI: Bu sorunun cevap anahtarı kesinleşmemiştir. Çözümü kendi ' +
                    'muhakemenle kur; yukarıdaki şık ile sonucun uyuşmazsa kendi sonucunu ' +
                    'yaz ve anahtarın doğrulanması gerektiğini belirt.');
    }

    return bolumler.join('\n');
  }

  /* Çevrimdışı çözüm yanıtı — model yokken elimizdeki veriyle
     dürüst bir çıktı üretir: aracı ve cevabı verir, adım adım
     anlatımın çevrimiçi koçta olduğunu söyler. */
  function yerelCozum(soru) {
    var araclar = aracKutusu(soru);
    var parcalar = ['Bu soruyu çözelim.'];

    if (araclar.length) {
      parcalar.push('Kullanılacak araçlar:\n' +
        araclar.slice(0, 4).map(function (f) { return '· ' + f; }).join('\n'));
    }

    parcalar.push('Doğru şık: ' + soru.dogru);

    if (soru.anahtarKaynagi === 'demo') {
      parcalar.push('Not: Bu sorunun anahtarı henüz kesinleşmedi, kendi çözümünle karşılaştır.');
    }

    parcalar.push('Adım adım anlatım için koçun çevrimiçi kipi gerekiyor; ' +
                  'şu an çevrimdışı motordayım. Yine de araç kutusundaki ilk kuralı ' +
                  'uygulayıp sonucu benimle karşılaştırabilirsin.');

    return parcalar.join('\n\n');
  }

  /* ===========================================================
     2) CEVAP SIZINTISI SÜZGECİ
     =========================================================== */
  function sizintiVarMi(metin, soru) {
    if (!metin || !soru || !soru.dogru) return false;
    var d = soru.dogru;

    /* Şık harfi TEK BAŞINA durmalı. Aksi hâlde koçun kendi
       "Cevap bende kalsın" gibi cümleleri, "bende" sözcüğünün baş
       harfi B şıkkı sanılarak engellenir. */
    var son = '(?![A-Za-zÇĞİÖŞÜçğıöşü])';

    var kaliplar = [
      /* "Cevap: D" · "yanıt = D" · "doğru seçeneği: D" */
      new RegExp('(cevab[ıi]|cevap|yan[ıi]t[ıi]?|sonu[çc])\\s*(ş[ıi]kk[ıi]|se[çc]ene[ğg]i)?\\s*[:=]\\s*["\\(]?' + d + '["\\)]?' + son, 'i'),
      /* "doğru şık D" · "doğru cevap D dir" */
      new RegExp('do[ğg]ru\\s+(ş[ıi]k+[ıi]?|cevap|cevab[ıi]|yan[ıi]t[ıi]?|se[çc]enek)\\s*["\\(]?' + d + '["\\)]?' + son, 'i'),
      /* "(D) şıkkı" · "\"D\" seçeneği" */
      new RegExp('["\\(]' + d + '["\\)]\\s*(ş[ıi]kk|se[çc]ene)', 'i'),
      /* "D şıkkı doğru" · "D seçeneğini işaretle" */
      new RegExp('\\b' + d + '\\s*(ş[ıi]kk|se[çc]ene)[a-zçğıöşü]*\\s*(do[ğg]ru|i[şs]aretle)', 'i')
    ];
    return kaliplar.some(function (k) { return k.test(metin); });
  }

  /* ===========================================================
     3) YEREL MOTOR — kural tabanlı Sokratik akış
     =========================================================== */

  var NIYET = [
    { ad: 'cevapIstegi',  kalip: /(cevab[ıi]|do[ğg]ru\s*ş[ıi]k|sonucu|yan[ıi]t[ıi])\s*(neydi|ne|s[öo]yle|ver|yaz)|ka[çc]t[ıi]r\s*cevap|hangi\s*ş[ıi]k/i },
    { ad: 'takildim',     kalip: /(tak[ıi]ld[ıi]m|bilmiyorum|anlamad[ıi]m|yapamad[ıi]m|hi[çc]\s*fikrim|nas[ıi]l\s*ba[şs]lar|nereden\s*ba[şs]l)/i },
    { ad: 'ipucuIstegi',  kalip: /(ipucu|yard[ıi]m|bir\s*ipu|hint|yol\s*g[öo]ster)/i },
    { ad: 'formulIstegi', kalip: /(form[üu]l|teorem|kural|ba[ğg][ıi]nt[ıi]|hangi\s*form|hangi\s*kural)/i },
    { ad: 'dogrulama',    kalip: /(buldum|[çc][ıi]kt[ıi]|do[ğg]ru\s*mu|olur\s*mu|=|e[şs]it)/i },
    { ad: 'selam',        kalip: /^(merhaba|selam|s\.?a\.?|iyi\s*g[üu]nler|hey)\b/i }
  ];

  function niyetBul(metin) {
    var bulunan = 'genel';
    NIYET.some(function (n) {
      if (n.kalip.test(metin || '')) { bulunan = n.ad; return true; }
      return false;
    });
    return bulunan;
  }

  var RET_CUMLELERI = [
    'Cevabı söylersem bu soru sana hiçbir şey kazandırmaz — sınavda yanında olamam. Ama birlikte bir adım daha atalım.',
    'Sonucu vermeyeceğim, çünkü asıl kazanacağın şey o değil. Şu adımı beraber görelim.',
    'Cevap bende kalsın; senin çıkarman lazım. Bir basamak daha inelim.'
  ];

  var ONAY_CUMLELERI = [
    'Güzel, doğru yoldasın.',
    'Evet, tam da oradan devam.',
    'İyi yakaladın.'
  ];

  function rastgele(dizi) { return dizi[Math.floor(Math.random() * dizi.length)]; }

  function yerelYanit(soru, mesaj, baglam) {
    var ipuclari = merdiven(soru);
    var araclar = aracKutusu(soru);
    var kontroller = kontrolSorulari(soru);
    var kademe = Math.max(0, Math.min(baglam.kademe || 0, ipuclari.length));
    var niyet = niyetBul(mesaj);
    var parcalar = [];
    var artir = false;

    switch (niyet) {

      case 'selam':
        parcalar.push('Merhaba! ' + (Limit.veri.soruSayfasi(soru.id) || {}).konu + ' konusundan ' + soru.no + '. sorudayız.');
        parcalar.push('Soruyu bir okudun mu — sence bu soru senden hangi bilgiyi kullanmanı istiyor?');
        break;

      case 'cevapIstegi':
        parcalar.push(rastgele(RET_CUMLELERI));
        if (ipuclari.length) {
          parcalar.push(ipuclari[Math.min(kademe, ipuclari.length - 1)]);
          artir = true;
        }
        break;

      case 'formulIstegi':
        if (araclar.length) {
          parcalar.push('Bu konuda işine yarayacak araçlar şunlar:');
          parcalar.push(araclar.slice(0, 3).map(function (f) { return '· ' + f; }).join('\n'));
          parcalar.push('Bunlardan hangisi sorunun sana verdiği bilgiyle doğrudan eşleşiyor?');
        } else {
          parcalar.push('Bu soruda hangi bilgiyi kullanman gerektiğini birlikte bulalım. Soruda sana verilenleri tek tek yazsan, hangisi bir kurala işaret ediyor?');
        }
        break;

      case 'takildim':
      case 'ipucuIstegi':
        if (kademe === 0) parcalar.push('Tıkanmak normal, birlikte açalım.');

        if (!ipuclari.length) {
          parcalar.push('Soruda verilenleri maddeler hâlinde yaz, sonra istenen tek şeyi altına not et. Bu ikisi arasında hangi bağlantı eksik?');
        } else if (kademe >= ipuclari.length) {
          parcalar.push('Merdivenin sonuna geldik, o yüzden araç kutusunu bir kez daha toparlayalım:');
          parcalar.push(araclar.map(function (f) { return '· ' + f; }).join('\n'));
          parcalar.push('Bu araçları sırayla uygularsan sonuca ulaşırsın. İlk işlemi yapıp bana sonucunu yazar mısın?');
        } else {
          parcalar.push(ipuclari[kademe]);
          artir = true;
        }
        break;

      case 'dogrulama':
        parcalar.push(rastgele(ONAY_CUMLELERI) + ' Ama doğrulamayı sana bırakayım:');
        parcalar.push(kontroller.length
          ? rastgele(kontroller)
          : 'Bulduğun değeri sorunun bütün koşullarına geri koyduğunda tutarlı çıkıyor mu? Kontrol edip söyler misin?');
        break;

      default:
        parcalar.push('Anladım. Şöyle ilerleyelim:');
        parcalar.push(ipuclari.length
          ? ipuclari[Math.min(kademe, ipuclari.length - 1)]
          : 'Soruda verilenleri ve istenen tek şeyi yan yana yaz. Aradaki köprüyü hangi kural kurar?');
        break;
    }

    return {
      metin: parcalar.join('\n\n'),
      yeniKademe: artir ? Math.min(kademe + 1, ipuclari.length) : kademe
    };
  }

  /* Öğrenci bir şık işaretlediğinde koçun kendiliğinden verdiği tepki */
  function isaretlemeTepkisi(soru, secim, dogruMu) {
    /* Anahtarı olmayan soru → öz değerlendirme kipi */
    if (dogruMu === null || dogruMu === undefined) {
      return secim + ' şıkkını işaretledin. Bu sorunun anahtarı bende yok, o yüzden onaylayan ben olmayacağım — ' +
             'sen olacaksın.\n\nSeçimini savun: bu şıkkı doğru yapan adım hangisiydi? ' +
             'Elediğin şıklardan birini neden elediğini de bir cümleyle yazar mısın?';
    }
    if (dogruMu) {
      return 'Doğru! Şimdi asıl önemli kısım: bu sonuca hangi adımla ulaştın? ' +
             'Kullandığın kuralı bir cümleyle özetleyebilir misin — böylece benzer soruda da tanırsın.';
    }
    var kontroller = kontrolSorulari(soru);
    return 'Olmadı, ama bu şıkkı seçmen bana nerede olduğunu gösteriyor.\n\n' +
           (kontroller.length
             ? kontroller[0]
             : 'Çözümünü baştan alalım: ilk yazdığın ifade neydi?');
  }

  /* ===========================================================
     4) SAĞLAYICI ADAPTÖRÜ
     =========================================================== */
  /**
   * Vekil sunucuya (Supabase Edge Function ya da yerel Node) istek atar.
   * OpenAI anahtarı burada YOKTUR; sunucuda durur.
   */
  function uzagaSor(ucNokta, sistem, mesajlar, kip) {
    var kfg = global.LimitAyar || {};

    var basliklar = { 'Content-Type': 'application/json' };
    /* Supabase Edge Function varsayılan olarak JWT doğrular; anon
       anahtarı geçerli bir JWT'dir ve uç noktayı asgari düzeyde
       kapalı tutar. Yerel Node sunucusu bu başlıkları yok sayar. */
    if (kfg.supabaseAnonKey) {
      basliklar['apikey'] = kfg.supabaseAnonKey;
      basliklar['Authorization'] = 'Bearer ' + kfg.supabaseAnonKey;
    }

    return fetch(ucNokta, {
      method: 'POST',
      headers: basliklar,
      body: JSON.stringify({
        sistem: sistem,
        mesajlar: mesajlar,
        /* Sunucu, kipe göre kendi değiştirilemez kuralını uygular:
           'yardim' → cevabı asla verme · 'cozum' → adım adım çöz */
        kip: kip === 'cozum' ? 'cozum' : 'yardim',
        model: kfg.aiModel || 'gpt-4o-mini',
        /* Çözüm kipinde sunucu zaten 2000'i dayatıyor; burayı da hizalı
           tutuyoruz ki eski bir sunucuya düşülse bile yarıda kesilmesin. */
        maxTokens: kip === 'cozum' ? 2000 : 400,
        temperature: kip === 'cozum' ? 0.2 : 0.4
      })
    }).then(function (y) {
      if (!y.ok) {
        return y.json().catch(function () { return {}; }).then(function (v) {
          throw new Error(v.hata || ('Uç nokta ' + y.status + ' döndü.'));
        });
      }
      return y.json();
    }).then(function (v) {
      /* Sade {metin} sözleşmesi; OpenAI ve Anthropic ham biçimleri de
         kabul edilir ki vekil sunucu değişse arayüz bozulmasın. */
      if (typeof v.metin === 'string') return v.metin;
      if (v.choices && v.choices[0] && v.choices[0].message) return v.choices[0].message.content;
      if (v.content && v.content[0] && v.content[0].text) return v.content[0].text;
      throw new Error('Uç noktadan beklenen biçimde yanıt gelmedi.');
    });
  }

  /* ===========================================================
     5) DIŞA AÇIK API
     =========================================================== */
  Limit.ai = {

    sistemIstemi: sistemIstemi,
    cozumIstemi: cozumIstemi,
    yerelCozum: yerelCozum,
    sizintiVarMi: sizintiVarMi,
    isaretlemeTepkisi: isaretlemeTepkisi,
    merdiven: merdiven,
    aracKutusu: aracKutusu,

    /** Koç açılırken ilk mesaj. Öğrenci daha önce denediyse ona göre başlar. */
    acilis: function (soru, ilerleme) {
      var sayfa = Limit.veri.soruSayfasi(soru.id) || {};
      var denemeler = (ilerleme && ilerleme.denemeler) || [];
      var giris = 'Selam! ' + sayfa.konu + ' · ' + soru.no + '. sorudayız.';

      if (denemeler.length && !(ilerleme && ilerleme.cozuldu)) {
        return giris + ' Birkaç şık denemişsin, henüz tutturamadın.\n\n' +
               'Cevabı söylemeyeceğim — ama şunu yanıtla: çözerken ilk yazdığın ifade neydi?';
      }
      return giris + ' Cevabı söylemeyeceğim — ama takıldığın her adımda yanındayım.\n\n' +
             'Başlamadan önce şunu düşün: bu soru senden hangi bilgiyi kullanmanı istiyor?';
    },

    /**
     * @returns {Promise<{metin:string, kademe:number, kaynak:string}>}
     */
    /**
     * @param {Object} istek {soru, mesaj, gecmis, baglam, kip}
     *   kip: 'yardim' (Sokratik, varsayılan) | 'cozum' (tam çözüm)
     */
    sor: function (istek) {
      var soru = istek.soru;
      var mesaj = istek.mesaj || '';
      var baglam = istek.baglam || {};
      var kip = istek.kip === 'cozum' ? 'cozum' : 'yardim';
      var ayar = Limit.depo.al().ayarlar;

      var yerel = function () {
        if (kip === 'cozum') {
          return { metin: yerelCozum(soru), kademe: baglam.kademe || 0, kaynak: 'yerel' };
        }
        var y = yerelYanit(soru, mesaj, baglam);
        return { metin: y.metin, kademe: y.yeniKademe, kaynak: 'yerel' };
      };

      if (ayar.aiSaglayici !== 'uzak' || !ayar.aiUcNokta) {
        return new Promise(function (coz) {
          setTimeout(function () { coz(yerel()); }, 260 + Math.random() * 240);
        });
      }

      var sistem = kip === 'cozum' ? cozumIstemi(soru) : sistemIstemi(soru, baglam);
      var mesajlar = (istek.gecmis || []).map(function (m) {
        return { role: m.rol === 'ogrenci' ? 'user' : 'assistant', content: m.metin };
      });
      mesajlar.push({ role: 'user', content: mesaj });

      return uzagaSor(ayar.aiUcNokta, sistem, mesajlar, kip)
        .then(function (metin) {
          /* Süzgeç yalnızca yardım kipinde çalışır; çözüm kipinde
             cevabı vermek zaten amaçtır. */
          if (kip !== 'cozum' && sizintiVarMi(metin, soru)) {
            console.warn('[Limit Koç] Sızıntı süzgeci devreye girdi, yerel yanıta düşülüyor.');
            var y = yerel();
            y.kaynak = 'yerel-suzgec';
            return y;
          }
          return {
            metin: metin,
            kademe: kip === 'cozum'
              ? (baglam.kademe || 0)
              : Math.min((baglam.kademe || 0) + 1, merdiven(soru).length),
            kaynak: 'uzak'
          };
        })
        .catch(function (h) {
          console.warn('[Limit Koç] Uzak sağlayıcı başarısız, yerel motora düşülüyor.', h);
          var y = yerel();
          y.kaynak = 'yerel-yedek';
          return y;
        });
    },

    oneriler: function (soru, ilerleme) {
      if (ilerleme && ilerleme.tamamlandi) {
        return soru.dogru && ilerleme.dogruMu === false
          ? ['Nerede hata yaptım?', 'Bu konuyu özetler misin?', 'Benzer soruda nelere dikkat etmeliyim?']
          : ['Yöntemimi kontrol eder misin?', 'Bu konuyu özetler misin?', 'Benzer soruda nelere dikkat etmeliyim?'];
      }
      return ['Nereden başlamalıyım?', 'Hangi formülü kullanmalıyım?', 'Bir ipucu ver'];
    }
  };

})(window);
