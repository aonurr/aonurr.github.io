"""
Position bias ve verbosity bias dosyalarından 10'luk kullanıcı setleri üretir.

Her set:
  - 5 xlsum_tr + 5 ragtruth sorusu
  - 5 position + 5 verbosity sorusu
  - 10 FARKLI haber, karışık sırada

Kullanım (proje kök klasöründe):
    python scripts/build_user_sets.py pbias_dataset.json vbias_dataset.json

Çıktılar:
    public/data/<userId>.json   -> ilk N kullanıcının setleri (sitede yayınlanır)
    data_pool/set_XXX.json      -> TÜM setler (yedek havuz, sitede yayınlanmaz)
    data_pool/assignments.json  -> hangi kullanıcı hangi seti aldı
    data_pool/setler_ozeti.csv  -> her setin özeti (Excel'de açılabilir)

Yapı:
  Her dataset'in haberleri karıştırılıp 5'erli gruplara bölünür. Bir xlsum grubu ile bir
  ragtruth grubu eşleşir (bir "çift"). Her çiftten İKİ set çıkar:
      Set A: xlsum'dan 3 position + 2 verbosity, ragtruth'tan 2 position + 3 verbosity
      Set B: aynı haberler, tamamlayıcı sürümler (xlsum 2p+3v, ragtruth 3p+2v)
  Tek çiftlerde oryantasyon tersine çevrilir, böylece set başına dağılım dengelenir.
  60 çift -> 120 set.
  Set 0..59  : A setleri. 600 haberin HER BİRİ bu setlerin tam birinde geçer (ortak haber yok).
  Set 60..119: B setleri (set k+60, set k ile aynı haberlerin diğer sürümleri).

Garantiler (script kendi kendini kontrol eder, ihlal olursa hata verip durur):
  1. Her soru (haber + özet çifti) tüm setler içinde TAM BİR kez kullanılır (1200 soru).
  2. Her sette 5 xlsum_tr + 5 ragtruth ve 5 position + 5 verbosity vardır.
  3. Bir setteki 10 soru 10 farklı haberden gelir.
  4. Set 0..59 arasında ortak haber yoktur.

Aynı SEED ile tekrar çalıştırırsanız aynı sonuç çıkar.
Not: İki dosyadaki haber metinleri birebir aynı olmalıdır (aynı haberlerin farklı özet versiyonları).
"""
import csv
import json
import os
import random
import sys
from collections import Counter

SEED = 42
GROUP = 5  # her dataset'ten set başına soru sayısı
DATASETS = ("xlsum_tr", "ragtruth")

if len(sys.argv) < 3:
    sys.exit("Kullanım: python scripts/build_user_sets.py <pbias.json> <vbias.json>")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


p = load(sys.argv[1])
v = load(sys.argv[2])

with open("scripts/user_ids.json", encoding="utf-8") as f:
    user_ids = json.load(f)
n_users = len(user_ids)

# --- İki dosyayı haber metnine göre eşle ve kontrol et ---
if len(p) != len(v):
    sys.exit(f"Dosyalardaki kayıt sayıları farklı: {len(p)} / {len(v)}")
v_by_text = {x["text"]: i for i, x in enumerate(v)}
if len(v_by_text) != len(v):
    sys.exit("vbias dosyasında tekrar eden haber metni var.")
for i, x in enumerate(p):
    j = v_by_text.get(x["text"])
    if j is None:
        sys.exit(f"pbias[{i}] haberi vbias'ta yok.")
    if v[j]["dataset"] != x["dataset"]:
        sys.exit(f"pbias[{i}] ve vbias[{j}] dataset etiketi farklı.")

# --- Haberleri dataset'e göre ayır, karıştır, 5'erli gruplara böl ---
rng = random.Random(SEED)
groups = {}
for ds in DATASETS:
    idxs = [i for i, x in enumerate(p) if x["dataset"] == ds]
    if len(idxs) % GROUP != 0:
        sys.exit(f"{ds}: {len(idxs)} haber {GROUP}'e tam bölünmüyor.")
    rng.shuffle(idxs)
    groups[ds] = [idxs[i:i + GROUP] for i in range(0, len(idxs), GROUP)]
n_pairs = len(groups[DATASETS[0]])
if any(len(groups[ds]) != n_pairs for ds in DATASETS):
    sys.exit("İki dataset'in haber sayıları eşit değil.")
if n_users > n_pairs:
    sys.exit(f"{n_users} kullanıcı için en az {n_users} çift gerekir, {n_pairs} var.")


def make_item(p_idx, variant):
    """p_idx: pbias dosyasındaki haber sırası. variant: 'p' (position) veya 'v' (verbosity)."""
    if variant == "p":
        return {"id": f"pbias_{p_idx}", "source": "position", **p[p_idx]}
    vi = v_by_text[p[p_idx]["text"]]
    return {"id": f"vbias_{vi}", "source": "verbosity", **v[vi]}


sets_a, sets_b = [], []
for k in range(n_pairs):
    xs, rg = groups["xlsum_tr"][k], groups["ragtruth"][k]
    if k % 2 == 0:
        x_p, x_v = xs[:3], xs[3:]   # xlsum: 3 position + 2 verbosity
        r_p, r_v = rg[:2], rg[2:]   # ragtruth: 2 position + 3 verbosity
    else:
        x_p, x_v = xs[:2], xs[2:]   # xlsum: 2 position + 3 verbosity
        r_p, r_v = rg[:3], rg[3:]   # ragtruth: 3 position + 2 verbosity
    a = [make_item(i, "p") for i in x_p + r_p] + [make_item(i, "v") for i in x_v + r_v]
    # Set B: aynı haberler, tamamlayıcı sürümler
    b = [make_item(i, "v") for i in x_p + r_p] + [make_item(i, "p") for i in x_v + r_v]
    rng.shuffle(a)  # 10 soru karışık sırada; sıra dosyada sabit kalır (ilerleme kaydı için gerekli)
    rng.shuffle(b)
    sets_a.append(a)
    sets_b.append(b)

sets = sets_a + sets_b  # set 0..n_pairs-1: A, set n_pairs..: B
n_sets = len(sets)

# --- Kontroller ---
all_ids = [it["id"] for s in sets for it in s]
assert len(all_ids) == len(set(all_ids)) == 2 * len(p), "Bir soru birden fazla sette kullanılmış!"
for k, s in enumerate(sets):
    assert len(s) == 2 * GROUP, f"Set {k}: soru sayısı hatalı"
    texts = [it["text"] for it in s]
    assert len(set(texts)) == len(texts), f"Set {k}: aynı haber iki kez var!"
    ds_count = Counter(it["dataset"] for it in s)
    assert ds_count == {"xlsum_tr": GROUP, "ragtruth": GROUP}, f"Set {k}: dataset dağılımı {dict(ds_count)}"
    src_count = Counter(it["source"] for it in s)
    assert src_count == {"position": GROUP, "verbosity": GROUP}, f"Set {k}: bias dağılımı {dict(src_count)}"
seen = set()
for k in range(n_pairs):
    for it in sets[k]:
        assert it["text"] not in seen, f"Set 0..{n_pairs - 1} arasında ortak haber var (set {k})!"
        seen.add(it["text"])
assert len(seen) == len(p)

# --- Yaz ---
os.makedirs("public/data", exist_ok=True)
os.makedirs("data_pool", exist_ok=True)
for folder in ("public/data", "data_pool"):
    for name in os.listdir(folder):
        if name.endswith((".json", ".csv")):
            os.remove(os.path.join(folder, name))

for k, s in enumerate(sets):
    with open(f"data_pool/set_{k:03d}.json", "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False)

assignments = {}
user_of_set = {}
for k, user_id in enumerate(user_ids):
    assignments[user_id] = k
    user_of_set[k] = user_id
    with open(f"public/data/{user_id}.json", "w", encoding="utf-8") as f:
        json.dump(sets[k], f, ensure_ascii=False)
with open("data_pool/assignments.json", "w", encoding="utf-8") as f:
    json.dump(assignments, f, indent=2)

with open("data_pool/setler_ozeti.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["set", "ayni_haberleri_iceren_set", "atanan_kullanici", "position", "verbosity",
                "xlsum_tr", "ragtruth", "kulturel", "soru_idleri"])
    for k, s in enumerate(sets):
        partner = k + n_pairs if k < n_pairs else k - n_pairs
        src = Counter(it["source"] for it in s)
        ds = Counter(it["dataset"] for it in s)
        cult = sum(it["type"] == "cultural" for it in s)
        w.writerow([f"set_{k:03d}", f"set_{partner:03d}", user_of_set.get(k, ""), src["position"], src["verbosity"],
                    ds["xlsum_tr"], ds["ragtruth"], cult, ";".join(it["id"] for it in s)])

cultural = [sum(it["type"] == "cultural" for it in s) for s in sets]
print(f"Haber: {len(p)} (xlsum_tr {sum(len(g) for g in groups['xlsum_tr'])}, ragtruth {sum(len(g) for g in groups['ragtruth'])})")
print(f"Toplam soru: {2 * len(p)} | Toplam set: {n_sets} (her biri 10 soru)")
print(f"Kullanıcılara verilen: {n_users} set (set 0-{n_users - 1}), yedekte kalan: {n_sets - n_users} set")
print("Kontroller: OK")
print("  - her sette 5 xlsum_tr + 5 ragtruth")
print("  - her sette 5 position + 5 verbosity")
print("  - her sette 10 farklı haber")
print("  - hiçbir soru iki sette kullanılmadı (1200 soru, 1200 benzersiz)")
print(f"  - set 0-{n_pairs - 1} arasında ortak haber yok (600 haberin her biri tam bir sette)")
print(f"Kültürel soru sayısı (set başına): min {min(cultural)}, maks {max(cultural)}, ortalama {sum(cultural) / len(cultural):.1f}")
