# Team VPS

Docker Compose for what Nemu runs outside Cloudflare: the Moodle test site for the F4 test cases
(PRD v2.3 §8), and `wa-bot`, which takes grade-book photos teachers send to the Nemu WhatsApp
number (F1-01, #203).

| Service    | Image                         | Why                                                                  |
| ---------- | ----------------------------- | -------------------------------------------------------------------- |
| `caddy`    | `caddy:2.11.9-alpine`         | HTTPS for `MOODLE_DOMAIN`, certificates renewed automatically        |
| `postgres` | `postgres:17-alpine`          | Moodle's database                                                    |
| `moodle`   | `erseco/alpine-moodle:v5.3.1` | Moodle 5.3 LTS, pinned so the import pages don't change mid-test     |
| `wa-bot`   | built from `apps/wa-bot`      | The Nemu WhatsApp number; hands teachers' photos to the Nemu Service |

## Deploy guide

About 30 minutes, most of it waiting for Moodle's first install. Commands run on the VPS unless a
step says otherwise.

### 1. What you need

- A Linux VPS (Ubuntu 24.04 or Debian 12) with at least 2 GB RAM and 20 GB disk, a public IP, and
  SSH access as a user who can `sudo`.
- Access to the Cloudflare DNS of `ahargunyllib.dev`.

### 2. Point the domain at the VPS

In Cloudflare DNS for `ahargunyllib.dev`, add an `A` record:

| Type | Name          | Content    | Proxy status |
| ---- | ------------- | ---------- | ------------ |
| A    | `nemu-moodle` | the VPS IP | **DNS only** |

Keep it **DNS only** (grey cloud). Caddy gets its own certificate from Let's Encrypt, and the
Cloudflare proxy gets in the way of that. Check it from your laptop; it should print the VPS IP:

```bash
dig +short nemu-moodle.ahargunyllib.dev
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

The repo is public, so a sparse clone fetches only this folder and the `wa-bot` source Compose
builds:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/ahargunyllib/nemu.git
cd nemu
git sparse-checkout set infra apps/wa-bot
cd infra
```

Later updates are `git pull` in the same folder.

### 6. Fill in `.env`

```bash
cp .env.example .env
openssl rand -base64 24   # run once for POSTGRES_PASSWORD, once for MOODLE_ADMIN_PASSWORD
nano .env
```

| Variable                | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| `MOODLE_DOMAIN`         | `nemu-moodle.ahargunyllib.dev` (no `https://`, no trailing slash)   |
| `POSTGRES_PASSWORD`     | a generated password                                                |
| `MOODLE_ADMIN_USERNAME` | `admin`                                                             |
| `MOODLE_ADMIN_PASSWORD` | a generated password; keep it in the team's password manager        |
| `TEACHER_PASSWORD`      | the password testers use for `siti.aminah`; share it with them      |
| `NEMU_SERVER_URL`       | `https://nemu-api.ahargunyllib.dev`                                 |
| `WA_BOT_SECRET`         | the Worker's `WA_BOT_SECRET`; see [wa-bot](#wa-bot-whatsapp-photos) |

Set `POSTGRES_PASSWORD` and the admin account before the first start. Moodle stores them on its
first install, so changing them in `.env` afterwards doesn't change the site.

### 7. Start it

```bash
docker compose up -d
docker compose logs -f moodle
```

This also builds and starts `wa-bot`; link its number with the [wa-bot](#wa-bot-whatsapp-photos)
steps. If Compose warns that a variable "is not set", stop (`docker compose down`) and fill it in `.env`
first. The first start installs Moodle into Postgres. Wait until the log shows `run: nginx`,
`run: php` and `run: cron`, about 3 to 5 minutes, then press Ctrl+C (the containers keep running). Open
`https://nemu-moodle.ahargunyllib.dev`: it shows "Masuk ke situs" once step 8 has run, or the
English login page before that.

### 8. Prepare the test course and the F4 quizzes

```bash
./setup-4a-uji.sh
```

It prints one line per step:

- Indonesian language pack installed and set as the default; outgoing mail turned off.
- Course `4A-UJI` ("Kelas 4A (uji)") with sections IPAS and Bahasa Inggris, and its default
  question bank.
- Teacher `siti.aminah` (password `TEACHER_PASSWORD`) and the three students in
  `setup/akun-siswa-uji.csv` (password `Nemu-uji-2026!`), all enrolled.
- **F4-1** (sections 2 and 3 of `setup/f4-1/F4-1_cara-pasang-di-moodle-uji.md`): the 15 questions
  of `setup/f4-1/F4-1_kuis-ipas-4a.xml` in Sistem bank soal bersama › Kuis Latihan IPAS 4A, and the
  quiz "Kuis IPAS 4A: Energi, Gaya, dan Peta" in IPAS (opens Wednesday 2 December 2026 07.00,
  closes Friday 4 December 2026 21.00, maximum grade 100, Soal 01 to 15 in order). Soal 07 has no
  correct answer and soal 15 has no `timbangan-3.png` on purpose; if Moodle refuses soal 07, the
  script uses the guide's fallback (import it with "setrika" at 100%, then set it to 0 in the
  database). It also sets the site's time zone to Asia/Jakarta.
- The F4-1 baseline, for section 4 of the guide and `setup/f4-1/F4-1_kunci.csv`:
  `F4-1 baseline: timemodified <unix time> (<date>), 15 questions`.
- **F4-3** (Persiapan steps 2 to 5 of `setup/f4-3/F4-3_skenario.md`): the 5 questions of
  `setup/f4-3/F4-3_kuis-my-family.xml` in Sistem bank soal bersama › Latihan My Family, and two
  quizzes in Bahasa Inggris: "Latihan: My Family (has/have)" (Monday 30 November 2026 07.00 to
  Friday 4 December 21.00, MF 01 to 05) and the decoy "Parts of Body + Family (pengecoh)" (Monday
  23 November 07.00 to Friday 27 November 21.00, MF 01 and 02). Then `siswa.aisyah`,
  `siswa.bagas` and `siswa.citra` each answer and submit the first quiz through Moodle's quiz
  attempt API (5/5, 3/5 and 2/5), so its **Hasil** page shows 3 attempts. It also switches off
  Moodle's user tours: the Mode Edit tour closes the menu Nemu points into.
- The last line is the F4-3 baseline: `F4-3 baseline: Latihan: My Family (has/have) (cmid <id>),
  3 finished attempts, 3 grades`.

Running it again changes nothing: it imports only missing questions, leaves an existing quiz as it
is and adds an attempt only for a student who hasn't submitted one. Check it: sign in as
`siti.aminah` and open Kelas 4A (uji). You should see the F4-1 quiz in IPAS, where **Soal** lists
15 questions, and both F4-3 quizzes in Bahasa Inggris, where **Hasil** of "Latihan: My Family
(has/have)" says "Yang telah mengerjakan: 3 orang".

F4-2 (#210) needs nothing more: Nemu creates its quiz from the teacher's script
(`setup/f4-2/`). Before running it again, remove the last run's quiz with
`docker compose cp setup/. moodle:/tmp/nemu-setup` and
`docker compose exec -T moodle php /tmp/nemu-setup/reset-f4-2.php`.

Moodle 5.3 differs from the guides in one place, for anything done by hand: **Bank soal** first
lists the course's question banks. Open **Sistem bank soal bersama**, then **Impor**. A database
shell, if you need one:

```bash
docker compose exec postgres psql -U moodle -d moodle
```

### 9. Hand over

Share with the team: the URL, `siti.aminah` with `TEACHER_PASSWORD`, and the student accounts
from `setup/akun-siswa-uji.csv`. The admin password stays in the password manager.

## wa-bot (WhatsApp photos)

`wa-bot` is linked to the Nemu WhatsApp number like WhatsApp Web. When a registered teacher sends a
photo, it reads the message, hands the photo to the Nemu Service, deletes it, and replies; the
photo then shows as a card in AlurSekolah. Photos from numbers that aren't registered teachers are
ignored: no read receipt, no download, no reply. It only makes outgoing connections, so it needs no
domain or open port.

It uses whatsmeow, an unofficial client, so WhatsApp may ban the number. Use a separate number
bought for Nemu, never someone's personal one. The bot answers one message at a time with
pauses, like a person.

### 1. Share a secret with the Nemu Service

Generate one secret and put the same value in two places:

```bash
openssl rand -base64 32
```

- The GitHub repository secret `WA_BOT_SECRET` (Settings › Secrets and variables › Actions), then
  rerun the **Deploy** workflow so the Worker gets it. Until it has one, the Worker refuses every
  call from the bot.
- `WA_BOT_SECRET` in `.env` on the VPS, with `NEMU_SERVER_URL` set to the Nemu Service.

### 2. Link the number

Have the phone with the Nemu number at hand, then:

```bash
docker compose up -d --build wa-bot
docker compose logs -f wa-bot
```

The log prints a QR code. On the phone, open WhatsApp › **Perangkat tertaut** › **Tautkan
perangkat** and scan it. A new code appears every minute or so; if they run out, the bot restarts and
prints more. The log says `number linked`, then `connected to WhatsApp` and `waiting for photos`.
Press Ctrl+C (the bot keeps running).

The session lives in the `wa_bot_data` volume, so restarts and updates don't need a new scan.

### 3. Check it

1. The teacher's number must be registered in Nemu (WS-06, #198).
2. From that phone, send a photo of a grade-book page to the Nemu number. Within about 20 seconds
   it shows as read, the bot types, and replies "Fotonya sudah diterima Nemu…".
3. `docker compose logs wa-bot` shows `photo handed over` with `outcome=queued`.
4. From a number that isn't registered, send a photo: it stays unread and the log says
   `ignored a photo from an unregistered number`.

### If something goes wrong

- **`missing configuration: set …`:** fill that variable in `.env`, then `docker compose up -d wa-bot`.
- **`hand-off failed` with `401 Unauthorized`:** the secrets differ, or the Worker hasn't been
  redeployed since the GitHub secret was set.
- **`the number was unlinked from WhatsApp`:** someone removed the linked device on the phone, or
  WhatsApp logged it out. The bot restarts and prints a new QR code; scan it as in step 2.
- **To link a different number:** `docker compose rm -sf wa-bot`, then
  `docker volume rm nemu-vps_wa_bot_data`, then step 2.

## Running it

| Task                       | Command                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Status                     | `docker compose ps`                                                                   |
| Logs                       | `docker compose logs -f moodle` (or `caddy`, `postgres`, `wa-bot`)                    |
| Stop / start               | `docker compose down` / `docker compose up -d` (data is kept)                         |
| Pull a change to this repo | `git pull`, then `docker compose up -d --build`                                       |
| Moodle CLI                 | `docker compose exec moodle php admin/cli/cfg.php --name=lang` (from `/var/www/html`) |
| Back up the database       | `docker compose exec postgres pg_dump -U moodle moodle > moodle-$(date +%F).sql`      |

Everything lives in named volumes (`postgres_data`, `moodledata`, `moodlehtml`, `wa_bot_data`,
and Caddy's certificates).

- **After a test changes the F4-1 quiz:** delete the quiz in Moodle, then run `./setup-4a-uji.sh`
  again; it recreates the quiz and prints a new baseline.
- **After an F4-3 run where the teacher deleted "Latihan: My Family (has/have)"** (round 2 of
  the scenario): run `./setup-4a-uji.sh` again. A deleted quiz waits for Moodle's cron before it is
  gone, so the script skips it and creates a new one with the 3 students' attempts; the last line
  must say `3 finished attempts, 3 grades`. Nothing else is needed; the deleted copy may still show
  in the course's recycle bin (Tempat sampah), which the test doesn't use.
- **To start over completely:** `docker compose down -v` deletes all data (and unlinks the WhatsApp
  number), then repeat steps 7 and 8 and link the number again.

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

Set `MOODLE_DOMAIN=localhost` in `.env` and follow steps 6 to 9, starting only Moodle (wa-bot
needs the WhatsApp number):

```bash
docker compose up -d caddy postgres moodle
```

Caddy serves `https://localhost` with its own certificate, so the browser warns once. The local
Nemu Service already lists it as an allowed website (`localhost:443`, "Moodle (uji, lokal)"), so
the Nemu button shows there. `pnpm --filter extension verify:f4-1` and `verify:f4-3` check F4-1
and F4-3 against it (see `apps/extension/README.md`). If an earlier stack on this machine left
volumes with another password, run under another project name, e.g. `COMPOSE_PROJECT_NAME=nemu-f4`,
for every command including `./setup-4a-uji.sh`. When you're done, `docker compose down -v`
removes the containers and their data.

**Two stacks at once, or 80/443 taken:** give the second one other host ports with an override
file outside the repo, e.g. `~/nemu-moodle-8443.yaml`:

```yaml
services:
  caddy:
    ports: !override
      - "8080:80"
      - "8443:8443"
  moodle:
    environment:
      # 8443 outside, 8080 inside the container: Moodle must trust the proxy's address.
      REVERSEPROXY: "true"
```

Set `MOODLE_DOMAIN=localhost:8443` in `.env` (Caddy then listens on 8443), and run every command,
`./setup-4a-uji.sh` included, with `COMPOSE_PROJECT_NAME=<another name>` and
`COMPOSE_FILE=compose.yaml:$HOME/nemu-moodle-8443.yaml`. In the Admin Workspace, add
`localhost:8443` under **Situs** ("baca dan isi"), and point the verify scripts at it with
`MOODLE_URL=https://localhost:8443/`.

## Host without a public IP

The deploy guide assumes a VPS with a public IP, where Caddy gets a certificate and serves 80/443. A
machine behind a campus or office network, reachable only over Tailscale or a VPN, has neither. A
Cloudflare Tunnel replaces both: `cloudflared` connects out to Cloudflare, which serves HTTPS for
the domain. Nothing listens on the machine, and no sudo or firewall change is needed. The team's
Moodle (`nemu-moodle.ahargunyllib.dev`) runs this way.

Follow the deploy guide, with these differences:

1. **Skip steps 2 and 4.** Don't add the A record and don't open ports.
2. **Create the tunnel**, once, in the Cloudflare account that holds `ahargunyllib.dev`:
   1. Zero Trust › Networks › Tunnels › **Create a tunnel**, type Cloudflared, name `nemu-vps`.
   2. Copy only the token from the install command it shows: the `eyJ…` part of
      `cloudflared service install eyJ…`. Don't run that command; the token goes into `.env`
      instead.
   3. **Public Hostname** › Add: subdomain `nemu-moodle`, domain `ahargunyllib.dev`, service
      **HTTP** `moodle:8080`. This creates the DNS record.
3. **In `.env`** (step 6), also set the three lines `.env.example` lists for this setup:
   - `TUNNEL_TOKEN` is the token;
   - `COMPOSE_FILE=compose.yaml:tunnel.yaml`, so every `docker compose` command adds the tunnel;
   - `AUTO_DEPLOY_SERVICES=postgres moodle tunnel wa-bot`, so Caddy never starts.
4. **Start it** (step 7) without Caddy:

   ```bash
   docker compose up -d postgres moodle tunnel
   docker compose logs tunnel
   ```

   The log shows four `Registered tunnel connection` lines. Ignore the `cert.pem` error, which
   token-based tunnels always print. `https://nemu-moodle.ahargunyllib.dev` answers once the
   Public Hostname exists.

## Deploying without SSH

`auto-deploy.sh` makes a merge to `main` the deploy, so only the person who set up the machine
needs SSH. It runs every 5 minutes from cron. It fetches `main`, and when `infra/` or
`apps/wa-bot/` changed, it resets the clone and runs `docker compose up -d --build` for
`AUTO_DEPLOY_SERVICES` (every service when unset). Install it once, as the user who owns the
clone, with no sudo:

```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * $PWD/auto-deploy.sh >> $HOME/nemu-auto-deploy.log 2>&1") | crontab -
```

Run that from `infra/`. Each deploy adds a line to `~/nemu-auto-deploy.log`.

- **Not covered:** one-off commands still need someone on the machine. That means
  `./setup-4a-uji.sh` after an F4 test, the wa-bot QR scan, and changes to `.env`.
- **Local edits are lost:** the script resets the clone to `main`. Put machine-specific settings in
  `.env` or in a file outside the clone, never in tracked files.
