"use strict";
/* Group 2: whole-word keyword matching. */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers.js");
const Core = H.quietCore();

const hay = (t) => Core.normalizeArabic(t.toLowerCase());

test("2: words inside other words do not match", () => {
    const no = [["كبيرة", "بيرة"], ["تغبيش", "غبي"], ["الهروين", "إله"], ["class", "ass"], ["pass", "ass"],
        ["shot", "hot"], ["spot", "pot"], ["begin", "gin"], ["hello", "hell"]];
    for (const [text, kw] of no) assert.equal(Core.keywordInText(hay(text), kw), false, text + " matched " + kw);
});

test("2: whole words and Arabic prefixes (و ف ب ل ك ال) match", () => {
    const yes = [["بيرة", "بيرة"], ["والبيرة", "بيرة"], ["فبيرة", "بيرة"], ["يا غبي!", "غبي"], ["وللإله", "إله"],
        ["what the hell", "hell"], ["kiss me", "kiss"], ["a gin tonic", "gin"], ["كالكلب", "كلب"], ["Ass!", "ass"]];
    for (const [text, kw] of yes) assert.equal(Core.keywordInText(hay(text), kw), true, text + " should match " + kw);
});

test("2: beer and wine are not in language.substanceTalk", () => {
    const st = Core.SUBCATEGORY_SCHEMA.language.subcategories.find((s) => s.key === "substanceTalk");
    assert.ok(!st.keywords.includes("beer") && !st.keywords.includes("wine"));
});
