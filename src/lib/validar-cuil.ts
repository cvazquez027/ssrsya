export function validarCuil(cuil: string): boolean {
  if (!cuil) {
    return false
  }

  // Remove hyphens and spaces for consistent processing
  const cleanCuil = cuil.replace(/[-\s]/g, "")

  // CUIL must have 11 digits
  if (cleanCuil.length !== 11) {
    return false
  }

  // Check if all characters are digits
  if (!/^\d+$/.test(cleanCuil)) {
    return false
  }

  const multiplier = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  const checkDigit = Number.parseInt(cleanCuil.charAt(10), 10)

  for (let i = 0; i < 10; i++) {
    sum += Number.parseInt(cleanCuil.charAt(i), 10) * multiplier[i]
  }

  const result = (11 - (sum % 11)) % 11

  // The result should match the check digit
  return result === checkDigit
}
