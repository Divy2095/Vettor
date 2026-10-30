def deduplicate(questions: list[dict], max_per_topic: int = 5) -> list[dict]:
    seen = {}
    result = []
    for q in questions:
        topic = q.get("topic", "General")
        seen[topic] = seen.get(topic, 0)
        if seen[topic] < max_per_topic:
            result.append(q)
            seen[topic] += 1
    return result


def group_by_topic(questions: list[dict]) -> dict[str, list]:
    grouped = {}
    for q in questions:
        topic = q.get("topic", "General")
        if topic not in grouped:
            grouped[topic] = []
        grouped[topic].append(q)
    return grouped


def sort_by_difficulty(questions: list[dict]) -> list[dict]:
    order = {"easy": 0, "medium": 1, "hard": 2}
    return sorted(questions, key=lambda q: order.get(str(q.get("difficulty", "medium")).strip().lower(), 1))