require("dotenv").config({ quiet: true });
const path = require("path");
const express = require("express");
const api = require("./routes/api");
const pages = require("./routes/pages");

const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Migration kontrolü: kod, migration ile eklenen sütunları sorguluyor
 * (örn. lohn_kalemler.pasif). Eksik migration varsa sunucu yine ayaga kalkar
 * ama hangi komutun gerektiği gürültülü şekilde yazılır; yoksa ilgili uçlar
 * 500 döner ve nedeni loglardan anlaşılmaz.
 */
const schema = require("./db/schema");
schema
  .eksikMigrationlar()
  .then((eksik) => {
    if (!eksik.length) return;
    console.error("UYARI: Uygulanmamis migration var: " + eksik.join(", "));
    console.error("      Sunucuda 'npm run db:migrate' calistirin (bu kod yeni sutunlari sorguluyor).");
  })
  .catch((hata) => {
    // Kontrol hatasi (orn. DB'ye baglanilamiyor) sunucunun acilmasini
    // engellemez ama nedeni soylemezse "migration eksik" sanilir.
    console.error("UYARI: Migration kontrolu yapilamadi: " + (hata && hata.message ? hata.message : hata));
  });

app.use("/api", api);
app.use("/", pages);

// Is dosyalari statik olarak sunulmaz; yetki kontrolu icin /api/dosyalar/:id/indir kullanilir.
// maxAge 0: tarayici her seferinde dogrular (304). Sabit sureli onbellek, guncellenmis
// CSS/JS'i kullanicida eski surumde birakip arayuzu bozuyordu.
app.use("/assets", express.static(path.join(__dirname, "assets"), { maxAge: 0, etag: true }));

app.use((req, res) => {
  res.status(404).sendFile("404.html", { root: __dirname }, (err) => {
    if (err) res.status(404).type("text").send("Sayfa bulunamadi.");
  });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, message: "Gonderilen veri okunamadi (gecersiz JSON)." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ ok: false, message: "Gonderilen veri cok buyuk." });
  }
  console.error(err);
  res.status(500).json({ ok: false, message: "Sunucu hatasi." });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Sunucu calisiyor: http://localhost:${port}`);
});
