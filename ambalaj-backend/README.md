# Ambalaj Backend

Ambalaj fiyat hesaplama uygulamasının backend API'si.

## 🚀 Kurulum

1. Bağımlılıkları yükle:

```bash
npm install
```

2. Environment variables'ları ayarla:

```bash
cp .env.example .env
# .env dosyasını düzenle
```

3. Veritabanını oluştur:

```bash
psql -U username -d database_name -f schema.sql
```

4. Sunucuyu başlat:

```bash
npm run dev  # Development
npm start    # Production
```

## 📡 API Endpoints

### Authentication

-   `POST /api/auth/register` - Kullanıcı kayıt
-   `POST /api/auth/login` - Kullanıcı giriş

### Prices

-   `GET /api/prices` - Kullanıcının fiyatlarını getir (Auth gerekli)
-   `POST /api/prices` - Kullanıcının fiyatlarını kaydet (Auth gerekli)

### Calculation

-   `POST /api/calculate` - Fiyat hesaplama (Auth gerekli)

## 🗄️ Veritabanı Şeması

-   `users` - Kullanıcı bilgileri
-   `user_prices` - Kullanıcıya özel fiyat ayarları
-   `calculations` - Hesaplama geçmişi

## 🚀 Deploy

### Railway (Önerilen)

1. [Railway.app](https://railway.app)'e git
2. GitHub reposunu bağla
3. PostgreSQL ekle
4. Environment variables ayarla
5. Deploy!

### Vercel

```bash
npm install -g vercel
vercel
```
