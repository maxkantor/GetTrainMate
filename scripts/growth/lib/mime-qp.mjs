/** RFC 2045 quoted-printable for UTF-8 payloads. */
export function encodeQuotedPrintable(utf8Text) {
  const normalized = String(utf8Text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  return lines
    .map((line) => encodeQpLine(line))
    .join('\r\n');
}

function encodeQpLine(line) {
  const buf = Buffer.from(line, 'utf8');
  let out = '';
  let col = 0;
  const emit = (token) => {
    if (col + token.length > 75) {
      out += '=\r\n';
      col = 0;
    }
    out += token;
    col += token.length;
  };
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    const isSafe = (b >= 33 && b <= 60) || (b >= 62 && b <= 126);
    if (isSafe) {
      emit(String.fromCharCode(b));
    } else if (b === 9 || b === 32) {
      if (i === buf.length - 1) {
        emit('=' + b.toString(16).toUpperCase().padStart(2, '0'));
      } else {
        emit(String.fromCharCode(b));
      }
    } else {
      emit('=' + b.toString(16).toUpperCase().padStart(2, '0'));
    }
  }
  return out;
}

export function decodeQuotedPrintable(input) {
  const s = String(input).replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /[0-9A-Fa-f]{2}/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}
