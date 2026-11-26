# Team VPS

Docker Compose for what Nemu runs outside Cloudflare: the Moodle test site for the F4 test cases
(PRD v2.3 §8), and later `wa-bot` (#203).

| Service    | Image                         | Why                                                              |
| ---------- | ----------------------------- | ---------------------------------------------------------------- |
| `caddy`    | `caddy:2.11.9-alpine`         | HTTPS for `MOODLE_DOMAIN`, certificates renewed automatically    |
| `postgres` | `postgres:17-alpine`          | Moodle's database                                                |
| `moodle`   | `erseco/alpine-moodle:v5.3.1` | Moodle 5.3 LTS, pinned so the import pages don't change mid-test |

## Deploy guide

About 30 minutes, most of it waiting for Moodle's first install. Commands run on the VPS unless a
step says otherwise.

### 1. What you need

- A Linux VPS (Ubuntu 24.04 or Debian 12) with at least 2 GB RAM and 20 GB disk, a public IP, and
  SSH access as a user who can `sudo`.
- Access to the Cloudflare DNS of `ahargunyllib.dev`.
- The F4 test-data folder `06_F4_kuis/` from the team Drive (`data-uji-mvp-v2`), for step 9.

### 2. Point the domain at the VPS

In Cloudflare DNS for `ahargunyllib.dev`, add an `A` record:

| Type | Name         | Content    | Proxy status |
| ---- | ------------ | ---------- | ------------ |
| A    | `moodle-uji` | the VPS IP | **DNS only** |

Keep it **DNS only** (grey cloud). Caddy gets its own certificate from Let's Encrypt, and the
Cloudflare proxy gets in the way of that. Check it from your laptop; it should print the VPS IP:

```bash
dig +short moodle-uji.ahargunyllib.dev
```

### 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and back in so the group applies, then check that both commands answer:

```bash
docker version
docker compose version
```

### 4. Open the ports

If the VPS uses `ufw`:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

If your provider has its own firewall (security group), open 80 and 443 there too. Nothing else
may already listen on 80 or 443 (`sudo ss -ltnp | grep -E ':80|:443'` prints nothing).

### 5. Get this folder onto the VPS

The repo is public, so a sparse clone fetches only this folder:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/ahargunyllib/nemu.git
cd nemu
git sparse-checkout set infra/vps
cd infra/vps
```

Later updates are `git pull` in the same folder.

### 6. Fill in `.env`

```bash
cp .env.example .env
openssl rand -base64 24   # run once for POSTGRES_PASSWORD, once for MOODLE_ADMIN_PASSWORD
nano .env
```

| Variable                | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| `MOODLE_DOMAIN`         | `moodle-uji.ahargunyllib.dev` (no `https://`, no trailing slash) |
| `POSTGRES_PASSWORD`     | a generated password                                             |
| `MOODLE_ADMIN_USERNAME` | `admin`                                                          |
| `MOODLE_ADMIN_PASSWORD` | a generated password; keep it in the team's password manager     |
| `TEACHER_PASSWORD`      | the password testers use for `siti.aminah`; share it with them   |

Set `POSTGRES_PASSWORD` and the admin account before the first start. Moodle stores them on its
first install, so changing them in `.env` afterwards doesn't change the site.

### 7. Start it

```bash
docker compose up -d
docker compose logs -f moodle
```

If Compose warns that a variable "is not set", stop (`docker compose down`) and fill it in `.env`
first. The first start installs Moodle into Postgres. Wait until the log shows `run: nginx`,
`run: php` and `run: cron`, about 3 to 5 minutes, then press Ctrl+C (the containers keep running). Open
`https://moodle-uji.ahargunyllib.dev`: it shows "Masuk ke situs" once step 8 has run, or the
English login page before that.

### 8. Prepare the test course

```bash
./setup-4a-uji.sh
```

It prints one line per step and ends with `Done.`:

- Indonesian language pack installed and set as the default; outgoing mail turned off.
- Course `4A-UJI` ("Kelas 4A (uji)") with sections IPAS and Bahasa Inggris, and its default
  question bank.
- Teacher `siti.aminah` (password `TEACHER_PASSWORD`) and the three students in
  `setup/akun-siswa-uji.csv` (password `Nemu-uji-2026!`), all enrolled.

Running it again changes nothing. Check it: sign in as `siti.aminah` and open Kelas 4A (uji). You
should see the IPAS and Bahasa Inggris sections and a **Bank soal** link.

### 9. Set up the quizzes

Follow the guides in `06_F4_kuis/`, signed in as `siti.aminah` (or the admin):

- **F4-1:** sections 2 to 4 of `F4-1_cara-pasang-di-moodle-uji.md` (import `F4-1_kuis-ipas-4a.xml`,
  then create "Kuis IPAS 4A: Energi, Gaya, dan Peta" in IPAS with 15 questions). Write down the
  quiz's last-modified time and question count, as the guide asks.
- **F4-3:** `F4-3_skenario.md` (import `F4-3_kuis-my-family.xml`, create both quizzes in
  Bahasa Inggris, then have the three students attempt "Latihan: My Family (has/have)").

Moodle 5.3 differs from the guide in one place: **Bank soal** first lists the course's question
banks. Open **Sistem bank soal bersama**, then **Impor**.

If Moodle refuses soal 07 because it has no correct answer, the F4-1 guide's fallback edits the
database directly. Open a database shell with:

```bash
docker compose exec postgres psql -U moodle -d moodle
```

### 10. Hand over

Share with the team: the URL, `siti.aminah` with `TEACHER_PASSWORD`, and the student accounts
from `setup/akun-siswa-uji.csv`. The admin password stays in the password manager.

## Running it

| Task                       | Command                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Status                     | `docker compose ps`                                                                   |
| Logs                       | `docker compose logs -f moodle` (or `caddy`, `postgres`)                              |
| Stop / start               | `docker compose down` / `docker compose up -d` (data is kept)                         |
| Pull a change to this repo | `git pull`, then `docker compose up -d`                                               |
| Moodle CLI                 | `docker compose exec moodle php admin/cli/cfg.php --name=lang` (from `/var/www/html`) |
| Back up the database       | `docker compose exec postgres pg_dump -U moodle moodle > moodle-$(date +%F).sql`      |

Everything lives in named volumes (`postgres_data`, `moodledata`, `moodlehtml`, and Caddy's
certificates).

- **After a test changes a quiz:** delete the quiz in Moodle and redo its part of step 9.
- **To start over completely:** `docker compose down -v` deletes all data, then repeat steps 7 to 9.

## Troubleshooting

- **The browser shows a certificate error, or Caddy's log says the ACME challenge failed:** the
  DNS record isn't pointing at the VPS yet, it's proxied (orange cloud), or port 80 is closed.
  Fix that, then `docker compose restart caddy`.
- **502 Bad Gateway right after the first start:** Moodle is still installing. Watch
  `docker compose logs -f moodle`.
- **Moodle keeps restarting:** read `docker compose logs moodle`. A wrong `POSTGRES_PASSWORD`
  after the first start is the usual cause; it has to match the one Postgres was created with.
- **Links point to the wrong address or loop between http and https:** `MOODLE_DOMAIN` must be
  exactly the domain in the browser. Change it, then `docker compose up -d`.

## Running it on your laptop

Set `MOODLE_DOMAIN=localhost` in `.env` and follow steps 6 to 9. Caddy serves
`https://localhost` with its own certificate, so the browser warns once.
