// Remove unpaired UTF-16 surrogates from a string. These appear when an emoji or
// other astral-plane character is split (e.g. by String.slice), leaving half a
// surrogate pair. JSON.stringify happily serializes them, but the Anthropic API
// rejects the resulting body with "no low surrogate in string". Stripping them at
// the boundary keeps every Claude call safe regardless of where the text came from.
export function stripLoneSurrogates(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate — keep only if immediately followed by a low surrogate.
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += input[i] + input[i + 1];
        i += 1;
      }
      // otherwise drop the lone high surrogate
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      // Lone low surrogate — drop it.
    } else {
      out += input[i];
    }
  }
  return out;
}
