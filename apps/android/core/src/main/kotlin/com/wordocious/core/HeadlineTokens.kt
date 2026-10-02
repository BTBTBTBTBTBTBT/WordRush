package com.wordocious.core

/**
 * FINISH_SPEC AR: live lettering for the rotating personalized headlines — a 1:1 port of
 * packages/core/src/headline-tokens.ts (asserted against headline-tokens-fixtures.json).
 * A headline ("WARMING UP · 3 DOWN", "OLIVER LEADS TODAY'S RACE", "YOU'RE #3 TODAY") splits
 * into tokens so every platform styles the same pieces:
 *   NUMBER → gold soft numbers ("3", "6,976", "#2", "3/8", "3:12", "85%", "3RD")
 *   NAME   → the palette's accent gradient (the player's / a friend's name)
 *   STAR   → the "·" separator, drawn as the tiny gold star sprite
 *   TEXT   → the main lettering (spaces included)
 */
object HeadlineTokens {
    enum class Kind(val key: String) { TEXT("text"), NUMBER("number"), NAME("name"), STAR("star") }

    data class Token(val kind: Kind, val text: String)

    /** The separator that becomes the star sprite. */
    const val STAR = '·'

    private val NUMBER = Regex("""^#?\d+(?:[,.:/]\d+)*(?:%|ST|ND|RD|TH)?""", RegexOption.IGNORE_CASE)

    private fun isWordChar(c: Char?): Boolean =
        c != null && (c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c == '_')

    private fun isAsciiLetter(c: Char?): Boolean = c != null && (c in 'A'..'Z' || c in 'a'..'z')

    /**
     * Split [text] into styled tokens. [names] are matched case-insensitively as whole
     * words (longest first); blank names are ignored. Adjacent plain text merges into one
     * token; nothing is dropped (the tokens join back to [text]).
     */
    fun split(text: String, names: List<String> = emptyList()): List<Token> {
        val wanted = names.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
            .sortedWith(compareByDescending<String> { it.length }.thenBy { it })
        val lower = text.lowercase()
        val out = ArrayList<Token>()
        fun push(kind: Kind, piece: String) {
            val last = out.lastOrNull()
            if (kind == Kind.TEXT && last?.kind == Kind.TEXT) out[out.size - 1] = last.copy(text = last.text + piece)
            else out.add(Token(kind, piece))
        }
        var i = 0
        while (i < text.length) {
            val ch = text[i]
            if (ch == STAR) { push(Kind.STAR, ch.toString()); i += 1; continue }
            val prev = if (i > 0) text[i - 1] else null
            if (!isWordChar(prev)) {
                val name = wanted.firstOrNull { n -> lower.startsWith(n.lowercase(), i) && !isWordChar(text.getOrNull(i + n.length)) }
                if (name != null) { push(Kind.NAME, text.substring(i, i + name.length)); i += name.length; continue }
                val m = NUMBER.find(text.substring(i))
                if (m != null && m.value.any { it.isDigit() } && !isAsciiLetter(text.getOrNull(i + m.value.length))) {
                    push(Kind.NUMBER, m.value); i += m.value.length; continue
                }
            }
            push(Kind.TEXT, ch.toString())
            i += 1
        }
        return out
    }
}
