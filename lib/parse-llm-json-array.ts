/**
 * Parse a JSON array of objects from LLM output, tolerantly.
 *
 * LLMs — especially capable, verbose ones — routinely emit *almost*-valid JSON:
 * literal (unescaped) newlines inside long string values, trailing commas, a
 * truncated final object when they hit the token limit, or prose/markdown around
 * the array. A strict JSON.parse rejects all of these and the attack is silently
 * dropped. This parser recovers them:
 *   1. extract the array region with STRING-AWARE bracket matching,
 *   2. strict parse,
 *   3. repaired parse (escape raw control chars inside strings, drop trailing
 *      commas),
 *   4. salvage — parse each complete top-level object individually, so a single
 *      malformed or truncated object never loses the rest.
 */
export function parseJsonArrayFromLlmResponse<T = unknown>(text: string): T[] {
  const cleaned = (text || "[]")
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const region = extractArrayRegion(cleaned);
  if (region === null) return [];

  const strict = tryParseArray<T>(region);
  if (strict) return strict;

  const repaired = repairJson(region);
  const rep = tryParseArray<T>(repaired);
  if (rep) return rep;

  return salvageObjects<T>(repaired);
}

/** Locate the array region: from the first `[` to its string-aware matching
 *  `]`, or — if truncated (no matching `]`) — to the end of the text. */
function extractArrayRegion(s: string): string | null {
  const start = s.indexOf("[");
  if (start < 0) return null;
  let inString = false;
  let escaped = false;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  // Truncated: no balancing `]`. Return from `[` to end for the salvage pass.
  return s.slice(start);
}

function tryParseArray<T>(s: string): T[] | null {
  try {
    const parsed = JSON.parse(s) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/** Escape raw control characters that appear INSIDE string literals, and drop
 *  trailing commas that sit before a `}` or `]` (outside strings). */
function repairJson(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) {
        out += c;
        escaped = false;
      } else if (c === "\\") {
        out += c;
        escaped = true;
      } else if (c === '"') {
        out += c;
        inString = false;
      } else if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else if (c.charCodeAt(0) < 0x20) {
        out += "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
      } else out += c;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
    } else if (c === ",") {
      // look ahead past whitespace for a closing bracket → trailing comma
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === "}" || s[j] === "]") {
        // skip the comma
      } else out += c;
    } else out += c;
  }
  return out;
}

/** Recover individual top-level `{...}` objects from (possibly truncated) array
 *  content, string-aware, parsing each on its own so one bad/cut object doesn't
 *  drop the others. */
function salvageObjects<T>(region: string): T[] {
  const results: T[] = [];
  let i = 0;
  const n = region.length;
  while (i < n) {
    if (region[i] !== "{") {
      i++;
      continue;
    }
    // walk a balanced object, string-aware
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let j = i; j < n; j++) {
      const c = region[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) break; // truncated final object — nothing complete left
    const objStr = region.slice(i, end + 1);
    try {
      results.push(JSON.parse(objStr) as T);
    } catch {
      try {
        results.push(JSON.parse(repairJson(objStr)) as T);
      } catch {
        /* skip this object */
      }
    }
    i = end + 1;
  }
  return results;
}
