// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
package dev.orion.grokbotface;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Decision logic for the "hey Grok Bot" wake phrase on top of Vosk grammar results.
 * The small English model has no "grok", so the grammar uses in-vocabulary sound-alikes
 * plus decoy phrases that soak up near misses (tuned on the box with TTS positives/negatives).
 */
final class WakeWord {
    static final String GRAMMAR = "[\"hey grog bot\", \"hey rock bot\", \"hey grog but\", \"hey grog\", \"hey rock\", \"hey\","
            + " \"hey bob\", \"hey rob\", \"hey google\", \"okay google\", \"hey crock pot\", \"robot\", \"[unk]\"]";
    static final String[] ACCEPT = {"hey grog bot", "hey rock bot", "hey grog but"};
    static final double MIN_MEAN_CONF = 0.75;
    static final double COOLDOWN_SEC = 5.0;

    private static final Pattern TEXT = Pattern.compile("\"text\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern PARTIAL = Pattern.compile("\"partial\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern CONF = Pattern.compile("\"conf\"\\s*:\\s*([0-9.eE+-]+)");

    static String text(String json) { Matcher m = TEXT.matcher(json); return m.find() ? m.group(1).trim() : ""; }
    static String partial(String json) { Matcher m = PARTIAL.matcher(json); return m.find() ? m.group(1).trim() : ""; }

    static double meanConf(String json) {
        Matcher m = CONF.matcher(json); double s = 0; int n = 0;
        while (m.find()) { try { s += Double.parseDouble(m.group(1)); n++; } catch (NumberFormatException ignored) {} }
        return n == 0 ? 0 : s / n;
    }

    static boolean accepted(String text) { for (String a : ACCEPT) if (a.equals(text)) return true; return false; }

    /** @return true if this final Vosk result is a confident wake phrase. */
    static boolean isWake(String resultJson) { return accepted(text(resultJson)) && meanConf(resultJson) >= MIN_MEAN_CONF; }

    private WakeWord() {}
}
