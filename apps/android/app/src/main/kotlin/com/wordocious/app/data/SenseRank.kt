package com.wordocious.app.data

/**
 * §259: which sense a word LEADS with. Line-for-line port of the web's
 * lib/sense-rank.ts (and scripts/rank-senses.mjs, which pre-ranks the bundled
 * word-definitions.json). Wiktionary orders parts of speech historically, so
 * NASTY led with "Something nasty." The dataset is pre-ranked; this is the
 * read-time guard so a future dataset with a bad first sense still displays
 * well. Change all four ports together.
 *
 * Rank: circular (3) > cross-reference stub (2) > defined through the word (1)
 * > clean (0); ties keep source order.
 */
object SenseRank {
    /** The headword or an inflection of it, in LOWERCASE (a capitalised mention is a name). */
    fun mentions(word: String, def: String): Boolean {
        val w = word.lowercase()
        if (w.length < 3) return false
        val stem = if (w.endsWith("e") || w.endsWith("y")) w.dropLast(1) else w
        val re = Regex("(^|[^A-Za-z])(${Regex.escape(w)}|${Regex.escape(stem)}(s|es|ed|ing|ies|ied|er|ers|ly|ness|iness))(?![A-Za-z])")
        return re.containsMatchIn(def)
    }

    /** Labels stripped: "(obsolete)", and a leading usage note "Preceded by the:". */
    fun core(def: String): String =
        def.replace(Regex("\\([^)]*\\)"), "").replace(Regex("^[^:.;]{0,40}:\\s*"), "").trim()

    private val frames = Regex(
        "^(something|someone|somebody|anything|one who|one that|those who|that which|the (act|action|state|quality|condition|result|process|sound|instance|manner|fact|practice) of|an? (\\w+ )?(act|action|instance|state|quality|result|sound|process|bout|fit) of|a person who|a thing that|an? \\w+ (thing|things|person|people|event|one|ones)\\b|in an? \\w+ (manner|way)\\b|to (make|become|be|render) \\w+ )",
        RegexOption.IGNORE_CASE,
    )
    private val stubs = Regex(
        "^(see\\b|alternative (form|spelling|letter-case form|case form) of|misspelling of|obsolete (form|spelling) of|archaic (form|spelling) of|dated (form|spelling) of|initialism of|abbreviation of|acronym of|synonym of|eye dialect (spelling )?of|clipping of|short for\\b)",
        RegexOption.IGNORE_CASE,
    )
    private val article = Regex("^(an?|the|any|one|its)\\b", RegexOption.IGNORE_CASE)
    private val toVerb = Regex("^to\\b", RegexOption.IGNORE_CASE)

    fun isCircular(word: String, def: String): Boolean {
        val c = core(def)
        return c.isNotEmpty() && mentions(word, c) && frames.containsMatchIn(c)
    }

    fun isStub(def: String): Boolean {
        val d = def.trim()
        if (d.length < 4) return true
        return stubs.containsMatchIn(d)
    }

    fun isDerived(word: String, def: String): Boolean {
        val c = core(def)
        if (c.isEmpty() || !mentions(word, c)) return false
        val words = c.split(Regex("\\s+")).filter { it.isNotEmpty() }
        val head = words.take(4).joinToString(" ")
        val tail = words.takeLast(2).joinToString(" ")
        if (words.isNotEmpty() && mentions(word, words[0])) return true
        if (words.size <= 6 && mentions(word, tail)) return true
        if (article.containsMatchIn(c)) return mentions(word, head)
        if (toVerb.containsMatchIn(c)) return mentions(word, head) || mentions(word, tail)
        return false
    }

    fun score(word: String, def: String?): Int {
        val d = def ?: ""
        if (isCircular(word, d)) return 3
        if (isStub(d)) return 2
        return if (isDerived(word, d)) 1 else 0
    }

    /** Best score first, source order within a score (sortedBy is stable). */
    fun <S> rank(word: String, senses: List<S>, def: (S) -> String?): List<S> =
        senses.sortedBy { score(word, def(it)) }
}
