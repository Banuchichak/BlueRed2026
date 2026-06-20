# Problem

Vishing (voice phishing) hücumlarında dələduzlar özlərini bank, dövlət qurumu və ya
tanınmış şirkət kimi təqdim edərək telefon zəngi vasitəsilə istifadəçilərdən həssas
məlumat (kart nömrəsi, OTP, şifrə) və ya pul tələb edirlər. İstifadəçilərin zəng edən
şəxsin həqiqətən iddia etdiyi qurumu təmsil etdiyini real vaxtda yoxlamaq imkanı yoxdur.

# Həll

Dövlət və özəl qurumların təsdiqlənmiş telefon nömrələrindən ibarət mərkəzi etibar
bazası yaradılır. Hər təsdiqlənmiş qurum müəyyən vaxt intervalında yenilənən unikal
təhlükəsizlik tokeni alır. Naməlum nömrədən zəng gələndə sistem zəng edənə iki seçim
təqdim edir: adi vətəndaşsa səsli mesaj buraxsın, qurum təmsilçisidirsə cari tokeni
təqdim etsin. Token bazadakı qeydlə üst-üstə düşürsə zəng qəbul edənə "təsdiqlənmiş
qurum" bildirişi göstərilir, əks halda saxtakarlıq riski barədə xəbərdarlıq edilir.
