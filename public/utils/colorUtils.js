export function getSecureRandomNumber() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2**32;
}

export function generateSecureRandomHexColor() {
  const r = Math.floor(getSecureRandomNumber() * 256);
  const g = Math.floor(getSecureRandomNumber() * 256);
  const b = Math.floor(getSecureRandomNumber() * 256);
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}