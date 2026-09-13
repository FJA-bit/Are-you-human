from flask import Flask, render_template, jsonify, request
import random
import time

app = Flask(__name__)

LEVELS = [
    {"name": "EASY", "limit": 30},
    {"name": "MEDIUM", "limit": 60},
    {"name": "HARD", "limit": 75},
    {"name": "EXTRA HARD", "limit": 105},
    {"name": "COMPLEX", "limit": 120},
]

GLOBAL_LIMIT = 600
RETRY_PENALTY = 60


def unique_options(correct, candidates):
    values = [str(x) for x in candidates if str(x) != str(correct)]
    values = list(dict.fromkeys(values))
    random.shuffle(values)
    values = [str(correct)] + values[:4]

    # Safety: always return five distinct options.
    fillers = ["Unknown", "Not enough information", "None", "All of these"]
    for item in fillers:
        if len(values) >= 5:
            break
        if item not in values:
            values.append(item)

    random.shuffle(values)
    return values[:5]


def make_q(text, options, answer):
    return {"text": text, "options": options, "answer": str(answer)}


def easy_questions():
    people = [
        ("Alice", "has a laptop"),
        ("Bob", "has a desktop computer"),
        ("Charlie", "has a smartphone"),
        ("Diana", "has a calculator"),
        ("Ethan", "has a robot"),
    ]
    random.shuffle(people)
    target = next(x for x in people if "computer" in x[1] or "laptop" in x[1])

    qs = [make_q(
        "Select the person who definitely has a COMPUTER.",
        [f"{n} — {f}" for n, f in people],
        f"{target[0]} — {target[1]}"
    )]

    a, b = random.randint(2, 20), random.randint(2, 20)
    correct = a + b
    qs.append(make_q(
        f"What is {a} + {b}?",
        unique_options(correct, [correct-1, correct+1, correct+2, correct+5]),
        correct
    ))

    correct = random.choice(["True", "False"])
    statement = (
        "Python lists can contain values of different data types."
        if correct == "True"
        else "Python variables must always be declared with a type."
    )
    qs.append(make_q(
        f"Is this statement correct?\n\n{statement}",
        ["True", "False", "Both", "Neither", "Cannot be determined"],
        correct
    ))
    return qs


def medium_questions():
    names = ["Alex", "Brian", "Chris", "David", "Evan"]
    facts = [
        "drank coffee today", "drank tea today", "drank water today",
        "drank juice today", "did not drink anything today"
    ]
    random.shuffle(facts)
    rows = list(zip(names, facts))
    target = random.choice(rows)

    qs = [make_q(
        f"SELECT THE PERSON WHO {target[1].upper()}.",
        [f"{n} — {f}" for n, f in rows],
        f"{target[0]} — {target[1]}"
    )]

    a, b = random.randint(10, 40), random.randint(2, 15)
    correct = a * b
    qs.append(make_q(
        f"Calculate: {a} × {b}",
        unique_options(correct, [correct+1, correct-1, correct+b, correct-b]),
        correct
    ))

    words = random.choices(["human", "robot"], k=5)
    target_word = random.choice(["human", "robot"])
    count = words.count(target_word)
    qs.append(make_q(
        f"How many times does '{target_word}' appear?\n\n{words}",
        unique_options(count, [count+1, count-1, 1, 2, 4]),
        count
    ))
    return qs


def hard_questions():
    people = [
        ("A", "slept for 8 hours"),
        ("B", "slept for 7 hours 59 minutes"),
        ("C", "slept for 8 hours 1 minute"),
        ("D", "slept for 7 hours 58 minutes"),
        ("E", "slept for 8 hours 2 minutes"),
    ]
    qs = [make_q(
        "SELECT THE PROGRAMMER WHO SLEPT FOR EXACTLY 8 HOURS.",
        [f"{n} — {f}" for n, f in people],
        "A — slept for 8 hours"
    )]

    a, b, c = random.randint(10, 25), random.randint(2, 9), random.randint(1, 8)
    correct = a * b - c
    qs.append(make_q(
        f"Calculate: ({a} × {b}) - {c}",
        unique_options(correct, [correct+1, correct-1, correct+c, correct-c]),
        correct
    ))

    nums = random.sample(range(10, 50), 5)
    correct = max(nums)
    qs.append(make_q(
        f"Select the LARGEST number:\n\n{nums}",
        [str(x) for x in nums],
        correct
    ))
    return qs


def extra_hard_questions():
    times = ["09:59:58", "09:59:59", "10:00:00", "10:00:01", "10:00:02"]
    qs = [make_q(
        "A system unlocks at exactly 10:00:00.\nSELECT THE EXACT UNLOCK TIME.",
        times, "10:00:00"
    )]

    a, b, c = random.randint(5, 12), random.randint(5, 12), random.randint(2, 6)
    correct = (a + b) * c
    qs.append(make_q(
        f"Calculate: ({a} + {b}) × {c}",
        unique_options(correct, [a+b*c, a*b+c, correct+c, correct-c]),
        correct
    ))

    vals = random.sample(range(20, 80), 5)
    correct = str(sorted(vals))
    options = [
        str(sorted(vals)), str(sorted(vals, reverse=True)), str(vals),
        str([x + 1 for x in sorted(vals)]), str([x - 1 for x in sorted(vals)])
    ]
    qs.append(make_q(
        "Which option lists the numbers in ASCENDING order?",
        options, correct
    ))
    return qs


def complex_questions():
    a, b, c = random.randint(3, 12), random.randint(3, 12), random.randint(1, 5)
    patterns = [
        (f"x = {a}\ny = {b}\nz = {c}\nprint(x * y + z)", a*b+c),
        (f"x = {a}\ny = {b}\nz = {c}\nprint((x + y) > (y + z))", (a+b) > (b+c)),
        (f"x = {a}\ny = {b}\nprint(x < y)", a < b),
        (f"x = {a}\ny = {b}\nprint(x == y)", a == b),
    ]
    expression, answer = random.choice(patterns)

    if isinstance(answer, bool):
        options = ["True", "False", "TRUE", "FALSE", "None"]
        answer = str(answer)
    else:
        options = unique_options(answer, [answer+1, answer-1, answer+c, answer-c])

    qs = [make_q(
        "FINAL TECHNICAL CHALLENGE\n\nWhat will this Python code print?\n\n" + expression,
        options, answer
    )]

    a, b, c = random.choice([True, False]), random.choice([True, False]), random.choice([True, False])
    answer = str((a and b) or c)
    qs.append(make_q(
        f"What is the result of:\n\n({a} AND {b}) OR {c}\n\nUse Python-style boolean meaning.",
        unique_options(answer, ["True", "False", "0", "1"]),
        answer
    ))

    nums = random.sample(range(10, 40), 5)
    index = random.randint(0, 4)
    answer = str(nums[index])
    qs.append(make_q(
        f"Given:\n\nnumbers = {nums}\n\nWhat is numbers[{index}]?",
        unique_options(answer, [nums[(index+1)%5], nums[index-1], nums[0], nums[-1]]),
        answer
    ))
    return qs


GENERATORS = [easy_questions, medium_questions, hard_questions, extra_hard_questions, complex_questions]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/question")
def question():
    level = request.args.get("level", type=int, default=0)
    if not 0 <= level < len(LEVELS):
        return jsonify({"error": "Invalid level"}), 400

    questions = GENERATORS[level]()
    random.shuffle(questions)
    return jsonify({
        "level": LEVELS[level],
        "questions": questions
    })


@app.route("/api/config")
def config():
    return jsonify({
        "levels": LEVELS,
        "global_limit": GLOBAL_LIMIT,
        "retry_penalty": RETRY_PENALTY
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
