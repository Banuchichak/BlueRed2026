# Vishing Shield — Simulyasiya MVP

**Komanda adı:** BlueRed
**Seçilmiş çağırış:** Vishing (telefon fishingi) hücumlarından qoruma

## Problem
Dələduzlar bank/dövlət qurumu kimi davranaraq telefon zəngi ilə istifadəçilərdən
həssas məlumat və ya pul tələb edir. İstifadəçinin zəng edənin həqiqiliyini real
vaxtda yoxlamaq imkanı yoxdur. Bax: [docs/problem-description.md](docs/problem-description.md)

## Həll
Təsdiqlənmiş qurumların etibarlı nömrə/token bazası üzərində qurulmuş real-vaxt
yoxlama sistemi. Naməlum nömrədən zəng gəldikdə zəng edənə "vətəndaş" və ya
"qurum təmsilçisi" seçimi təqdim olunur; qurum təmsilçisi cari təhlükəsizlik
tokenini təqdim etməlidir.

## Əsas funksiyalar
- Standard User və Business User üçün ayrıca qeydiyyat/giriş
- Kontakt siyahısı ilə tanınan zənglərin avtomatik filtrasiyası
- Naməlum nömrədən zəng gələndə: vətəndaş (səsli mesaj) / qurum (token) ayrımı
- Şirkətlər üçün admin təsdiqi və avtomatik token rotasiyası (30 dəqiqəlik TTL)
- Token yoxlanışı: düzgün/yanlış/vaxtı bitmiş/təsdiqlənməmiş ssenariləri
- Zəng tarixçəsi (audit log)

## Texnologiya steki
- Backend: Node.js + Express (in-memory state, JSON fayl üzərində etibarlı baza)
- Frontend: vanil JS, HTML, CSS (heç bir framework asılılığı yoxdur)

## Necə işə salınır
```bash
cd vishing-shield
npm install
npm start
```
Sonra brauzerdə açın: http://localhost:3000

## Demo giriş məlumatları
Qeydiyyatdan keçərək istənilən telefon nömrəsi ilə test istifadəçisi yarada bilərsiniz.
Hazır test nömrələri (`data/trusted_numbers.json`):
- `+994125551234` — AzBank ASC (təsdiqlənib)
- `+994125559876` — Vergilər Nazirliyi (təsdiqlənib)
- `+994505550000` — Naməlum Mikro Kredit MMC (təsdiqlənməyib — rədd ssenarisi üçün)

Cari token dəyərlərini admin panelindəki (bölmə 2) siyahıdan götürə bilərsiniz.

## Nümunə data
[data/sample-data.csv](data/sample-data.csv)

## Məhdudiyyətlər (hazırkı)
- Real telefon şəbəkəsi (PSTN/VoIP) inteqrasiyası yoxdur, hər şey brauzer simulyasiyasıdır.
- Token rotasiyası serverin yaddaşında simulyasiya olunur, persistensiya yalnız JSON fayl səviyyəsindədir.
- Autentifikasiya sadələşdirilib (parol yoxdur) — MVP məqsədlidir.

## Gələcək inkişaf imkanları
- openbanking de kommunikasiya rolunu öz üstümüzə götürmək
- sima ilə login 
- userlerin
- Real mobil tətbiq (Android/iOS) + telefon şəbəkəsi inteqrasiyası (CNAM/STIR-SHAKEN bənzəri)
- Bank/dövlət qurumları üçün rəsmi API ilə token inteqrasiyası
- Maşın öyrənməsi ilə şübhəli nömrə davranışının aşkarlanması

## Etik və hüquqi qeydlər
Bax: [docs/ethical-declaration.md](docs/ethical-declaration.md)
