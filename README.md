# Srpski helper — Serbian ⇄ Russian conversation assistant (prototype)

Phone-first web app:

- **Слушать (Listen)**: someone speaks Serbian. The app transcribes it, shows a Russian translation, adds notes (false friends, idioms, grammar) and suggests 3 Serbian replies.
- **Сказать (Say)**: you speak Russian. The app gives you 3 ways to say it in Serbian (neutral, polite, casual).
- You can also type in Serbian (Latin or Cyrillic) or Russian.
- A toggle switches the Serbian text between Latin and Cyrillic.

## How it works

```
phone mic ──► /api/transcribe ──► OpenAI gpt-4o-transcribe (speech → text)
                     │
                     ├──► /api/translate ──► Claude Haiku   (fast: translation line)
                     └──► /api/assist    ──► Claude Sonnet  (notes + 3 replies, JSON)
                                   │
                                   └──► /api/log ──► Supabase `turns` (optional)
```

The translation and the notes/replies are requested in parallel, so the translation shows first.

## Environment variables

| Name | Required | What it is |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude (translation and suggestions) |
| `OPENAI_API_KEY` | yes | Speech-to-text only. The Claude API does not accept audio. |
| `APP_PASSCODE` | yes | Any secret phrase. The app asks for it once per device. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | no | Saves history. Leave empty to skip. |
| `ANTHROPIC_FAST_MODEL`, `ANTHROPIC_SMART_MODEL`, `OPENAI_STT_MODEL` | no | Model overrides |

## Run locally

```bash
cp .env.example .env.local     # fill in the keys
npm install
npm run dev                     # http://localhost:3000
```

Microphone access needs **HTTPS** on a phone (localhost on the computer is fine).
To test from your phone on Wi-Fi, use `npm run dev -- --experimental-https`, or deploy to Vercel and test there.

## Deploy to Vercel (Hobby)

1. Push this folder to a GitHub repo.
2. vercel.com → **Add New → Project** → import the repo (framework: Next.js, defaults are fine).
3. **Settings → Environment Variables**: add the variables above for Production and Preview.
4. Deploy. On iPhone: open the URL in Safari → Share → **Add to Home Screen**.

## Supabase (optional, shared by local and Vercel)

1. Create a project at supabase.com (free tier).
2. **SQL Editor** → paste `supabase/migrations/0001_turns.sql` → Run.
3. **Project Settings → API Keys** → copy the project URL and the **secret** key into `SUPABASE_URL` / `SUPABASE_SECRET_KEY`, in both `.env.local` and Vercel.

Use the same project for local and Vercel so both write to one database.
The key is only used on the server. The table has RLS enabled and no public policies.

## Cost (rough)

- Speech-to-text: fractions of a cent per minute of audio.
- Claude: about 1–2k tokens per utterance, so a 30-minute conversation costs cents.
- Check current prices on each provider's pricing page.
