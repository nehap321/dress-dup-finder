export class JsonScan {
  static matchBracket(text: string, start: number, open: string, close: string): number {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === open) depth += 1;
      else if (char === close) {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  static productArrays(text: string): unknown[][] {
    const arrays: unknown[][] = [];
    const needle = '"products":';
    let from = 0;
    while (from < text.length) {
      const found = text.indexOf(needle, from);
      if (found < 0) break;
      let cursor = found + needle.length;
      while (text[cursor] === " ") cursor += 1;
      if (text[cursor] !== "[") {
        from = found + needle.length;
        continue;
      }
      const end = JsonScan.matchBracket(text, cursor, "[", "]");
      if (end < 0) break;
      try {
        const parsed = JSON.parse(text.slice(cursor, end + 1)) as unknown;
        if (Array.isArray(parsed)) arrays.push(parsed);
      } catch {
        // The next candidate may be escaped RSC text rather than raw JSON.
      }
      from = end + 1;
    }
    return arrays;
  }
}
