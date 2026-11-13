"""Categories, their CLIP prompts, and how they map to Salik library filters."""

CATEGORIES = {
    "sexual": {"ar": "مشاهد جنسية", "library": "nudity", "action": "skip", "prompts": [
        "a photo of a naked person", "a photo of people having sex", "a photo of people kissing passionately",
        "a photo of a person in underwear or lingerie", "a photo of a woman in a bikini", "a sexual scene from a movie",
        "a photo of bare breasts", "a photo of a naked couple in bed"]},
    "violence": {"ar": "عنف", "library": "violence", "action": "skip", "prompts": [
        "a photo of people fighting", "a photo of a person being shot", "a photo of a gun pointed at a person",
        "a photo of someone being stabbed", "a photo of a person punching another person", "a photo of an explosion",
        "a photo of a war battle scene", "a photo of a person being strangled"]},
    "gore": {"ar": "مشاهد مقززة / دموية", "library": "violence", "action": "blur", "prompts": [
        "a photo of blood and gore", "a photo of a bloody wound", "a photo of a dead body", "a photo of a corpse",
        "a photo of a severed body part", "a photo of a person vomiting", "a photo of a disgusting rotten mess",
        "a photo of a horror monster attacking"]},
    "substance": {"ar": "تعاطٍ (تدخين / خمر / مخدرات)", "library": "substance abuse", "action": "blur", "prompts": [
        "a photo of a person smoking a cigarette", "a photo of a person drinking alcohol", "a photo of a person using drugs",
        "a photo of a bottle of beer or wine", "a photo of a person smoking weed", "a photo of people drinking at a bar",
        "a photo of a person injecting drugs", "a photo of a person snorting cocaine"]},
}

NEUTRAL_PROMPTS = [
    "a photo of people talking", "a photo of a landscape", "a photo of a person sitting", "a photo of text on a screen",
    "a photo of an ordinary room", "a photo of a city street", "a close-up photo of a face", "a cartoon",
    "a screenshot of a video game", "a photo of a person walking", "a photo of food on a table", "a photo of a car",
    "a photo of a person cooking", "a photo of children playing", "a photo of an office", "a dark blurry frame",
    "a photo of a person holding a phone", "a photo of a crowd", "a photo of an animal", "a title card",
    "a photo of a cat", "a photo of a dog", "a photo of pets on a couch", "a photo of a teddy bear", "a photo of toys",
    "a photo of people playing sports", "a photo of a person skiing", "a photo of a baseball game", "a photo of a football match",
    "a photo of a person running", "a photo of a living room", "a photo of a bedroom", "a photo of a kitchen",
    "a photo of people hugging", "a photo of a family dinner", "a photo of a concert", "a photo of people dancing",
    "a photo of a bus or train", "a photo of a sign", "a photo of a computer screen", "a photo of a classroom",
    "a photo of a beach", "a photo of a park", "a photo of a building", "a photo of the sky",
]

LANGUAGE = {"ar": "ألفاظ خارجة", "library": "language", "action": "mute"}
SPEECH_SEXUAL = {"ar": "كلام جنسي", "library": "nudity", "action": "mute"}
SPEECH_SUBSTANCE = {"ar": "كلام عن التعاطي", "library": "substance abuse", "action": "mute"}

ALL_LABELS = {**{k: v["ar"] for k, v in CATEGORIES.items()}, "language": LANGUAGE["ar"],
              "speech_sexual": SPEECH_SEXUAL["ar"], "speech_substance": SPEECH_SUBSTANCE["ar"]}
