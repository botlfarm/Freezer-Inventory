/**
 * UPC-A Weight-Embedded Barcode Utilities
 *
 * Format Specification:
 * - 12 digits total
 * - Position 1 (index 0): Prefix '2' (indicates random weight / price-lookup item)
 * - Positions 2-6 (indices 1-5): 5-digit Item Number (zero-padded if shorter)
 * - Positions 7-11 (indices 6-10): 5-digit Weight (xxx.xx representation in hundredths of a lb; default 00000 for 0.00 lbs)
 * - Position 12 (index 11): Modulo-10 Check Digit
 */

/**
 * Calculates the UPC-A modulo-10 check digit from the first 11 digits.
 */
export function calculateUpcACheckDigit(first11Digits: string): number {
  const digits = String(first11Digits).replace(/\D/g, '');
  if (digits.length < 11) return 0;
  
  let oddSum = 0;
  let evenSum = 0;
  
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(digits[i], 10) || 0;
    if (i % 2 === 0) {
      // 1st, 3rd, 5th, 7th, 9th, 11th digit (1-indexed odd positions)
      oddSum += digit;
    } else {
      // 2nd, 4th, 6th, 8th, 10th digit (1-indexed even positions)
      evenSum += digit;
    }
  }
  
  const total = oddSum * 3 + evenSum;
  return (10 - (total % 10)) % 10;
}

/**
 * Generates the default 0-lb weight-embedded UPC-A barcode for a product using its item number.
 * Example: Item number '15425' -> '215425000003'
 */
export function generateDefaultUpcABarcode(itemNumber?: string | number): string | undefined {
  if (itemNumber === undefined || itemNumber === null) return undefined;
  const cleaned = String(itemNumber).replace(/\D/g, '');
  if (!cleaned) return undefined;
  
  // Pad with leading zeros to 5 digits, or take last 5 digits
  const item5 = cleaned.padStart(5, '0').slice(-5);
  const first11 = `2${item5}00000`;
  const checkDigit = calculateUpcACheckDigit(first11);
  return `${first11}${checkDigit}`;
}

/**
 * Generates a 12-digit weight-embedded UPC-A barcode given the product's base barcode and weight in lbs.
 * 
 * Uses the product's assigned base barcode as the primary source:
 * - Keeps the first 6 digits (prefix + item code) exactly as configured in Odoo / Product catalog.
 * - Replaces the 5-digit weight section (characters 7-11) with the actual cumulative weight in hundredths of a lb.
 * - Recalculates and appends the final modulo-10 check digit.
 * 
 * Returns empty string if baseBarcode is missing or invalid (< 6 digits).
 */
export function generateWeightEmbeddedUpc(baseBarcode: string | number | undefined | null, weightLbs: number): string {
  if (!baseBarcode) return '';
  const cleaned = String(baseBarcode).trim().replace(/\D/g, '');
  if (cleaned.length < 6) return '';
  
  // Take first 6 digits from the assigned base barcode
  const first6 = cleaned.substring(0, 6);
  
  // Convert weight to 5 digits representing xxx.xx in hundredths of a lb
  const weightNum = Math.max(0, Number(weightLbs) || 0);
  const weightHundredths = Math.round(weightNum * 100);
  const weight5 = String(weightHundredths).padStart(5, '0').slice(-5);
  
  const first11 = `${first6}${weight5}`;
  const checkDigit = calculateUpcACheckDigit(first11);
  return `${first11}${checkDigit}`;
}

/**
 * Validates whether a given string is a valid 12-digit UPC-A barcode with matching check digit.
 */
export function validateUpcABarcode(barcode: string): boolean {
  const cleaned = String(barcode || '').trim().replace(/\D/g, '');
  if (cleaned.length !== 12) return false;
  const first11 = cleaned.substring(0, 11);
  const checkDigit = parseInt(cleaned[11], 10);
  return calculateUpcACheckDigit(first11) === checkDigit;
}

/**
 * Parses a 12-digit weight-embedded UPC-A barcode into item number, weight (in lbs), and check digit validity.
 */
export function parseWeightEmbeddedUpc(barcode: string): {
  prefix: string;
  itemNumber: string;
  weightLbs: number;
  checkDigit: number;
  isValid: boolean;
} | null {
  const cleaned = String(barcode || '').trim().replace(/\D/g, '');
  if (cleaned.length !== 12) return null;
  
  const prefix = cleaned[0];
  const itemNumber = cleaned.substring(1, 6);
  const weightHundredths = parseInt(cleaned.substring(6, 11), 10) || 0;
  const checkDigit = parseInt(cleaned[11], 10);
  const isValid = calculateUpcACheckDigit(cleaned.substring(0, 11)) === checkDigit;
  
  return {
    prefix,
    itemNumber,
    weightLbs: Math.round(weightHundredths) / 100,
    checkDigit,
    isValid
  };
}
