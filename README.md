# Are You Human? — Verification Game

A VS Code-ready TypeScript + Express web game styled like a deliberately ridiculous CAPTCHA.

## Features
- Five levels: Easy (30s), Medium (60s), Hard (75s), Extra Hard (105s), Complex (120s)
- 10-minute global round timer
- Fresh randomized questions on every start/retry
- Exactly 5 answer choices per challenge
- Distractors become increasingly similar as difficulty rises
- Wrong answer or timeout fails the run
- Retry the failed level for a 60-second global-time penalty
- Server keeps the correct answer private; the browser receives only public question data
- Final reward: `🤖 HUMAN VERIFICATION COMPLETE` and `KEY: R`

## Run in VS Code
Install Node.js LTS, open this folder in VS Code, then:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5000

For production-style:
```bash
npm run build
npm start
```

### Important
This is a game/verification simulation, not a security-grade CAPTCHA. For a real anti-bot system, add server-side rate limiting, signed sessions, CSRF protection where appropriate, bot detection, and database/session storage.
