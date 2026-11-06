export const consoleLogText = (raw: string): string => {
  let state: "text" | "escape" | "csi" | "string" | "stringEscape" = "text";
  let output = "";

  for (const character of raw) {
    const code = character.codePointAt(0)!;

    if (state === "string" || state === "stringEscape") {
      if (code === 0x07 || code === 0x9c || (state === "stringEscape" && character === "\\")) {
        state = "text";
      } else {
        state = code === 0x1b ? "stringEscape" : "string";
      }
      continue;
    }

    if (code === 0x1b) {
      state = "escape";
      continue;
    }

    if (state === "escape") {
      if (character === "[") {
        state = "csi";
      } else if (
        character === "]" || character === "P" || character === "X" ||
        character === "^" || character === "_"
      ) {
        state = "string";
      } else if (code >= 0x30 && code <= 0x7e) {
        state = "text";
      }
      continue;
    }

    if (state === "csi") {
      if (code >= 0x40 && code <= 0x7e) {
        state = "text";
      }
      continue;
    }

    if (code === 0x9b) {
      state = "csi";
    } else if (code === 0x90 || code === 0x98 || code === 0x9d || code === 0x9e || code === 0x9f) {
      state = "string";
    } else if (character === "\n" || character === "\t" || (code >= 0x20 && !(code >= 0x7f && code <= 0x9f))) {
      output += character;
    }
  }

  return output;
};