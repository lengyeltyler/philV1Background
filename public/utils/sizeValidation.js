export function validateSVGSize(svgString, maxSize = 240000) {
  const size = new Blob([svgString]).size;
  if (size > maxSize) {
    throw new Error(`SVG size ${size} exceeds maximum allowed ${maxSize}.`);
  }
}