# Kanzlei Brands Plattform

Mitgliederbereich für Kanzlei Brands Kunden: Bewerber- & Lead-Management (CRM/ATS),
Schulungsbereich (LMS) und Kunden-Hub für Angebote/Upsells – als eigenständige
Multi-Tenant-SaaS-Plattform.

## Architektur

- **Next.js 16** (App Router, TypeScript) – gehostet auf **Vercel**
- **PostgreSQL** via **Prisma 7** (Driver Adapter `@prisma/adapter-pg`) – empfohlen: **Neon** oder **Supabase**
- **Auth.js (NextAuth v5)** – Credentials-Login mit JWT-Sessions, Rollen- und Mandanten-Kontext im Token
- **Vercel Blob** für Kursvideo-Uploads (lokal: Fallback auf `public/uploads`)
- OAuth2 gegen **Google (Gmail API)** und **Microsoft 365 (Graph API)** für Postfach-Anbindung

### Mandantenmodell

```
Organization (type: AGENCY)         "Kanzlei Brands" – Betreiber-Account
  └─ Organization (type: CLIENT)     Ein Kunde von Kanzlei Brands
       ├─ User (CLIENT_ADMIN)        Voller Zugriff auf den Kunden-Account
       ├─ User (CLIENT_STAFF)        Zugriff nur auf zugewiesene Pipelines
       └─ Pipeline (LEADS/APPLICANTS)  Eine Kampagne mit eigenen Stages & Kontakten
```

- **AGENCY_ADMIN** (Kanzlei-Brands-Team): legt Kunden an, verwaltet Kunden-übergreifend,
  sieht das globale Audit-Log, verwaltet Schulungskurse und Angebote im Kunden-Hub.
- **CLIENT_ADMIN**: verwaltet die eigenen Mitarbeiter (CLIENT_STAFF), vergibt
  Pipeline-Zugriffe pro Kampagne, sieht alle eigenen Pipelines.
- **CLIENT_STAFF**: sieht nur die Pipelines, die ihm explizit zugewiesen wurden.

E-Mail-Postfächer werden pro **Mitarbeiter** (nicht pro Lead) verbunden; Nachrichten
werden am jeweiligen Kontakt gespeichert.

## Setup (lokal)

```bash
npm install
cp .env.example .env   # Werte ausfüllen, siehe unten
npx prisma migrate dev
npm run db:seed
npm run dev
```

Test-Logins nach dem Seed:
- Agentur-Admin: `lukas@kanzlei-brands.de` / `changeme123`
- Kunden-Admin: `admin@demo-kunde.de` / `changeme123`

**Wichtig:** Passwörter nach dem ersten Login in einer echten Umgebung ändern.

## Umgebungsvariablen

Siehe `.env.example` für die vollständige Liste. Pflichtfelder:

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Postgres-Connection-String |
| `AUTH_SECRET` | Signierschlüssel für Sessions (`openssl rand -base64 32`) |
| `TOKEN_ENCRYPTION_KEY` | AES-256-Schlüssel zur Verschlüsselung gespeicherter Mailbox-Tokens |

Optional (je nach Feature):

| Variable | Zweck |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail-Postfach-Anbindung |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft-365-Postfach-Anbindung |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob für Kursvideo-Uploads (Produktion) |

## Lead-Eingang (Webhooks)

Jede Pipeline hat einen eigenen Webhook-Endpunkt unter
`/api/webhooks/{token}` (POST, JSON-Body). Die URL findet sich auf der jeweiligen
Pipeline-Seite im Dashboard. Funktioniert direkt mit:

- **OnePage**, **Perspektive** – Webhook-Ziel in der jeweiligen Plattform eintragen
- **Zapier** – "Webhooks by Zapier" Action mit der URL
- Beliebige andere Quelle, die JSON per POST senden kann

Häufige Feldnamen (`email`, `first_name`, `phone`, ...) werden automatisch erkannt.
Für abweichende Feldnamen kann pro Pipeline ein JSON-Mapping hinterlegt werden
(Pfad im Payload → Contact-Feld).

**Meta Lead Ads / LinkedIn Lead Gen Forms** benötigen eine App-Review bzw.
Business-Verifizierung bei Meta bzw. die LinkedIn Marketing Developer Platform,
bevor ein natives Webhook-Abo eingerichtet werden kann (das dauert je nach Anbieter
Tage bis Wochen und erfordert Zugriff auf den Facebook Business Manager bzw. die
LinkedIn Company Page). Bis dahin: beide Plattformen lassen sich in der Praxis auch
über Zapier/Make an den generischen Endpunkt anbinden.

## E-Mail-Postfach verbinden

1. Google-Cloud-Projekt anlegen, OAuth-Consent-Screen konfigurieren, Gmail API aktivieren,
   OAuth-Client-ID (Web) mit Redirect-URI `https://<domain>/api/mailbox/google/callback` anlegen.
2. Azure-AD-App-Registrierung anlegen, Redirect-URI `https://<domain>/api/mailbox/microsoft/callback`,
   API-Berechtigungen `Mail.Send` und `Mail.Read` (delegiert) hinzufügen.
3. Client-ID/Secret in die Umgebungsvariablen eintragen.

Ohne diese Variablen bleiben die "Verbinden"-Buttons im Dashboard deaktiviert – die
restliche Plattform funktioniert unabhängig davon.

## Deployment (Vercel)

1. Repo mit Vercel verbinden.
2. Postgres-Datenbank bereitstellen (z. B. Neon oder Supabase) und `DATABASE_URL` setzen.
3. Alle Umgebungsvariablen aus `.env.example` in den Vercel-Projekteinstellungen setzen.
4. Der `build`-Script führt automatisch `prisma migrate deploy` vor `next build` aus –
   Migrationen werden bei jedem Deploy angewendet.
5. Für Kursvideo-Uploads: Vercel-Blob-Store im Projekt aktivieren, `BLOB_READ_WRITE_TOKEN`
   wird dabei automatisch gesetzt.
6. Einmalig `npm run db:seed` gegen die Produktionsdatenbank ausführen (oder den ersten
   Agentur-Admin manuell per SQL/Prisma Studio anlegen) – danach das Seed-Skript nicht
   erneut gegen Produktionsdaten laufen lassen.

## Branding

Farben/Logo sind aktuell Platzhalter (shadcn-Default-Theme). Sobald Kanzlei-Brands-
Styleguide (Logo, Farben, Fonts) vorliegt: Tokens in `src/app/globals.css`
(`:root` / `.dark`) sowie `Organization.logoUrl` / `Organization.primaryColor`
für Kunden-spezifisches Branding anpassen.

## DSGVO / Compliance

- Alle sicherheitsrelevanten Aktionen (Kunde/Nutzer anlegen, Pipeline-Zugriff,
  Statusänderungen, Kontakt-Ansicht, Angebots-Interesse) werden im `AuditLog`
  protokolliert und sind unter „Audit-Log" im Dashboard einsehbar.
- Mailbox-Tokens werden AES-256-verschlüsselt gespeichert, nie im Klartext.
- Für den Produktivbetrieb: EU-Hosting-Region für Datenbank und Vercel-Deployment wählen,
  Auftragsverarbeitungsverträge mit Kunden abschließen, Löschkonzept/Aufbewahrungsfristen
  definieren.

## Noch offen / nächste Schritte

- Native Meta-/LinkedIn-Lead-Ads-Integration (erfordert Business-Verifizierung, s. o.)
- Stripe-Checkout im Kunden-Hub, falls Angebote später direkt buchbar sein sollen
- Eigene Mobile App (App Store) – sekundäres Ziel laut Anforderung, Plattform ist
  bereits PWA-fähig aufgebaut als Basis dafür
- Echtes Branding (Logo, Farben) sobald verfügbar
