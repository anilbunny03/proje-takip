# Katkı / Contributing

## Türkçe

Katkılar memnuniyetle karşılanır. Hata veya öneri için GitHub'da bir issue açın; gerçek proje verisi, kişisel bilgi veya gizli içerik paylaşmayın.

- Arayüz Türkçedir; kullanıcıya görünen metinler Türkçe kalmalıdır. Belgeler Türkçe ve İngilizce tutulur: bir belgeyi değiştirirken karşılığını da güncelleyin.
- Bağımlılık: npm yoktur. Çalışma zamanı kütüphaneleri `vendor/` içindedir; yenisini eklerseniz lisans dosyasını da ekleyin ve [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasını güncelleyin.
- Değişiklikten önce testleri çalıştırın:

```bash
node --test tests/*.test.cjs
python -B -m unittest discover -s tests -p 'test_*.py'
```

- Paketi denemek için: `python -B tools/package.py` (`dist/Proje-Takip-Uygulamasi.zip`).
- Küçük, odaklı pull request'ler tercih edilir. Katkınızın MIT lisansı ([LICENSE](LICENSE)) altında yayımlanmasını kabul etmiş olursunuz.

## English

Contributions are welcome. Open a GitHub issue for bugs or ideas; do not share real project data, personal information or confidential content.

- The UI is Turkish; user-visible strings must stay Turkish. Docs are kept in Turkish and English: when you change one, update its counterpart.
- Dependencies: there is no npm. Runtime libraries live in `vendor/`; if you add one, include its license file and update [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Run the tests before submitting:

```bash
node --test tests/*.test.cjs
python -B -m unittest discover -s tests -p 'test_*.py'
```

- To try packaging: `python -B tools/package.py` (`dist/Proje-Takip-Uygulamasi.zip`).
- Small, focused pull requests are preferred. By contributing you agree your work is released under the MIT license ([LICENSE](LICENSE)).
