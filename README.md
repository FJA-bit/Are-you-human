# Human Verification Protocol — Web Version

A Flask + HTML/CSS/JavaScript implementation of the deliberately ridiculous CAPTCHA game.

## Requirements

- Python 3.10+
- Flask

## Setup in VS Code

Open this folder in VS Code, then run:

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Install Flask:

```bash
pip install -r requirements.txt
```

Start the server:

```bash
python app.py
```

Open the address shown by Flask, normally:

http://127.0.0.1:5000

## Project structure

```text
human_verification_web/
├── app.py
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
└── static/
    └── style.css
```

## Notes

The server generates fresh questions on every level request. The browser handles the live countdown and game state.

The answer key is kept in the server response for this prototype. For a production game, answers should not be exposed to the browser; use a server-side session/game ID and submit answer IDs instead.
