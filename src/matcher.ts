/**
 * Converts a wildcard pattern to RegExp
 *
 * `*` matches any characters (0 or more)
 *
 * @param pattern - Wildcard pattern string
 * @param flags - RegExp flags (default: "")
 * @returns RegExp equivalent of the wildcard pattern
 *
 * @example
 * ```typescript
 * wildcardToRegExp("*.example.com").test("api.example.com"); // true
 * wildcardToRegExp("https://*.com/*").test("https://example.com/path"); // true
 * ```
 */
export const wildcardToRegExp = (pattern: string, flags = ""): RegExp => {
  const escaped = RegExp.escape(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`, flags);
};

/**
 * Input type for createKeywordMatcher
 */
type MatcherInput = string | RegExp | MatcherInput[];

/**
 * Options for createKeywordMatcher
 */
type MatcherOptions = {
  /** Enable wildcard matching (* matches any characters) */
  wildcard?: boolean;
};

/**
 * Creates a matcher function from keywords, patterns, and regex
 *
 * Accepts multiple input formats:
 * - Multiline string: each line is a keyword (supports `//` or `#` comments)
 * - RegExp: used directly
 * - Array: recursively processed
 * - Lines starting with `/pattern/flags` are parsed as RegExp
 *
 * @param inputs - Keywords, patterns, or regex to match against
 * @param options - Matcher options
 * @returns A function that tests if a string matches any pattern
 *
 * @example
 * ```typescript
 * const matcher = createKeywordMatcher(`
 *   foo
 *   bar   // comment is ignored
 *   /^exact$/
 * `);
 *
 * matcher("foo");         // true (partial match)
 * matcher("contains foo"); // true
 * matcher("exact");       // true
 * matcher("not exact");   // false (regex requires exact match)
 *
 * // Wildcard mode
 * const urlMatcher = createKeywordMatcher(`
 *   https://*.example.com/*
 * `, { wildcard: true });
 *
 * urlMatcher("https://api.example.com/path"); // true
 * ```
 */
export const createKeywordMatcher = (
  inputs: MatcherInput | MatcherInput[],
  options: MatcherOptions = {},
) => {
  const { wildcard = false } = options;

  const parsePatterns = (input: MatcherInput): RegExp[] => {
    if (input instanceof RegExp) return [input];
    if (Array.isArray(input)) return input.flatMap(parsePatterns);
    if (typeof input !== "string") return [];

    const lines = input
      .split(/[\r\n]+/)
      .map((s) => s.replace(/\s+(\/\/|#).*$/, "").trim())
      .filter(Boolean);

    const patterns: RegExp[] = [];
    const literals: string[] = [];

    for (const line of lines) {
      const match = /^\/(.+)\/([gimsuyv]*)$/.exec(line);
      if (match?.[1]) {
        patterns.push(new RegExp(match[1], match[2] ?? ""));
      } else {
        literals.push(line);
      }
    }

    if (literals.length > 0) {
      if (wildcard) {
        patterns.push(...literals.map((s) => wildcardToRegExp(s)));
      } else {
        patterns.push(
          new RegExp(literals.map((s) => RegExp.escape(s)).join("|")),
        );
      }
    }

    return patterns;
  };

  const patterns = parsePatterns(inputs);
  return (str: string) => patterns.some((p) => p.test(str));
};

/**
 * Executes callback if current URL matches any of the patterns
 *
 * Uses wildcard matching by default (* matches any characters)
 *
 * @param patterns - URL patterns to match against location.href
 * @param callback - Function to execute if URL matches
 *
 * @example
 * ```typescript
 * onUrlMatch(`
 *   https://*.example.com/*
 *   https://api.foo.com/*
 * `, () => {
 *   console.log("Matched!");
 * });
 * ```
 */
export const onUrlMatch = (
  patterns: MatcherInput | MatcherInput[],
  callback: () => void,
) => {
  const loc = globalThis as unknown as { location?: { href: string } };
  if (!loc.location) return;
  const matcher = createKeywordMatcher(patterns, { wildcard: true });
  if (matcher(loc.location.href)) {
    callback();
  }
};
