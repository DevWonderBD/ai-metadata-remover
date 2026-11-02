# cPanel Deployment Guide (No Node.js Server Required)

This guide walks you through deploying **AI Metadata Remover** on any traditional shared cPanel hosting (Apache/Nginx with PHP & MySQL).

Because the React app is pre-compiled into static HTML, CSS, and JS, **your cPanel does NOT need Node.js runtime installed**.

---

## Architecture Overview

```
cPanel Hosting (public_html/)
├── index.html                  <-- Built from React (Vite)
├── assets/                     <-- Bundled CSS, JS, Images
├── manifest.json & sw.js       <-- PWA & Offline Support
└── api/                        <-- Lightweight PHP Backend
    ├── config.php              <-- Database Credentials
    ├── stats.php               <-- REST API for visitor & image counts
    └── schema.sql              <-- MySQL Table Schema
```

---

## Step 1: Build the Static Production Files

On your local machine or terminal:
```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build
```
This generates a production-ready `dist/` directory containing all client-side assets.

---

## Step 2: Set Up MySQL Database in cPanel

1. Log into your **cPanel Dashboard**.
2. Navigate to **MySQL® Databases** (or MySQL Database Wizard):
   - Create a database: e.g., `devwonder_aimr`
   - Create a user: e.g., `devwonder_user` with a secure password.
   - Add the user to the database with **ALL PRIVILEGES**.
3. Open **phpMyAdmin**:
   - Select your newly created database.
   - Click on the **Import** tab.
   - Choose the file [`api/schema.sql`](api/schema.sql) from this repository and click **Go**.
   - This creates the `site_stats` table and sets up initial counters.

---

## Step 3: Upload Files to cPanel `public_html`

1. Open **cPanel File Manager** and go to `public_html` (or your subdomain folder).
2. Upload the contents of your local **`dist/`** folder directly into `public_html/`.
   - `index.html` should be directly in `public_html/index.html`.
   - `assets/` folder inside `public_html/assets/`.
   - `manifest.json`, `sw.js`, and favicon files inside `public_html/`.
3. Create an `api/` folder inside `public_html/`:
   - Upload [`api/stats.php`](api/stats.php) into `public_html/api/stats.php`.
   - Create `public_html/api/config.php` (copy from [`api/config.example.php`](api/config.example.php)) and update your MySQL database credentials:
     ```php
     <?php
     define('DB_HOST', 'localhost');
     define('DB_NAME', 'devwonder_aimr');
     define('DB_USER', 'devwonder_user');
     define('DB_PASS', 'your_actual_password');
     define('ALLOWED_ORIGIN', '*');
     ```

---

## Step 4: Configure `.htaccess` for Apache

Ensure you have a `.htaccess` file in `public_html/` with the following configuration for clean single-page app routing and gzip compression:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Allow direct access to the api/ folder and existing files
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Redirect all other requests to index.html for client-side routing
  RewriteRule ^ index.html [L]
</IfModule>

# Enable Browser Caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

---

## Verification

1. Visit your domain: `https://yourdomain.com`
2. Test uploading an image: the cleaning process runs immediately in your browser.
3. Check `https://yourdomain.com/api/stats.php` to verify the JSON API returns current metrics.
4. Test offline mode: turn off WiFi and clean images — they process instantly, and stats will automatically sync to your database when you reconnect!
