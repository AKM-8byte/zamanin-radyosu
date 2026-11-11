# Zamanın Radyosu

Saatten ve tarihten üretilen, sürekli çalan ambient müzik.

**Canlı:** https://akm-8byte.github.io/zamanin-radyosu/

## Nasıl çalışır

- Müzik ses dosyası olarak saklanmaz, tarayıcıda o anda üretilir.
- Yerel tarih ve saatten bir *seed* üretilir. Aynı yerel saatte siteyi açan herkes aynı müziği duyar, her gece de bir öncekinden farklıdır.
- Seed her saat için şunlara karar verir:
  - akorlar, motifler ve tempo,
  - hangi enstrümanın solo başlayacağı,
  - katmanların hangi sırayla girip çıkacağı,
  - sessizliklerin nerede olacağı.
- Günün saatine göre müziğin karakteri değişir:
  - **Gece (22–05):** Hicaz çeşnili armonik minör, yankılı piyano, gitar, harmonika ve ney. Uzun sessizlikler var.
  - **Şafak (05–08):** Majör 7'li akorlar, kalimba ve flüt, kalp atışı gibi bir davul, kuşlar.
  - **Gündüz (08–17):** Lo-fi davul, elektrik piyano, kalimba, flüt, bas ve kuşlar.
  - **Akşam (17–22):** Minöre dönüş, yumuşak davul, elektrik piyano ve harmonika.
- Ekrandaki ufuk sahnesi saate göre değişir. Ay gerçek ay evresine göre çizilir, dalgalar müziğe tepki verir.

## Kullanım

- Ekrana dokunarak başlat, tekrar dokunarak durdur. Boşluk tuşu da çalışır.
- Fareyi hareket ettirince ses kontrolü belirir. Ok tuşlarıyla sesi açıp kısabilir, M tuşuyla sessize alabilirsin.
- Site uygulama olarak yüklenebilir (PWA). Android'de ekran kapalıyken de çalmaya devam eder ve kilit ekranında kontrolleri gösterir.
- Test için saati değiştirmek istersen adresin sonuna `?saat=02:30` ekle.

## Yerelde çalıştırma

```bash
python -m http.server 8765
```

## Teşekkürler

- [Tone.js](https://tonejs.github.io/): Web Audio çatısı.
- Piyano kayıtları: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3), Alexander Holm, CC BY 3.0.

Yapan: **Ahmet Kayra**. [GitHub](https://github.com/AKM-8byte) · [Instagram](https://instagram.com/ahmetkyrm) · [Web](https://akm-8byte.github.io/akmwebsite/)
