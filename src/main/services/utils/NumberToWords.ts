// ============================================================
// HENU OS — Number To Words Utility
// Converts numerical amounts & share counts to uppercase words + number
// Example: 10 -> "TEN (10)", 50 -> "FIFTY (50)", 500 -> "FIVE HUNDRED (500)"
// ============================================================

const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
];

const TENS = [
  '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
];

export function convertNumberToWordsOnly(num: number): string {
  if (isNaN(num) || num <= 0) return '';
  num = Math.floor(num);

  if (num < 20) {
    return ONES[num];
  }
  if (num < 100) {
    const tensPart = TENS[Math.floor(num / 10)];
    const onesPart = ONES[num % 10];
    return onesPart ? `${tensPart} ${onesPart}` : tensPart;
  }
  if (num < 1000) {
    const hundredsPart = `${ONES[Math.floor(num / 100)]} HUNDRED`;
    const remainder = num % 100;
    return remainder ? `${hundredsPart} AND ${convertNumberToWordsOnly(remainder)}` : hundredsPart;
  }
  if (num < 100000) {
    const thousandsPart = `${convertNumberToWordsOnly(Math.floor(num / 1000))} THOUSAND`;
    const remainder = num % 1000;
    return remainder ? `${thousandsPart} ${convertNumberToWordsOnly(remainder)}` : thousandsPart;
  }
  if (num < 10000000) {
    const lakhsPart = `${convertNumberToWordsOnly(Math.floor(num / 100000))} LAKH`;
    const remainder = num % 100000;
    return remainder ? `${lakhsPart} ${convertNumberToWordsOnly(remainder)}` : lakhsPart;
  }
  const croresPart = `${convertNumberToWordsOnly(Math.floor(num / 10000000))} CRORE`;
  const remainder = num % 10000000;
  return remainder ? `${croresPart} ${convertNumberToWordsOnly(remainder)}` : croresPart;
}

/**
 * Returns formatted words with parenthesized number, e.g. "TEN (10)"
 */
export function formatSharesWithWords(val: string | number | undefined | null): string {
  if (!val) return '';
  const str = String(val).trim();
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num <= 0) return str;
  const words = convertNumberToWordsOnly(num);
  return words ? `${words} (${num})` : str;
}

/**
 * Returns formatted currency in words, e.g. "FIFTY RUPEES ONLY"
 */
export function formatRupeesInWords(val: string | number | undefined | null): string {
  if (!val) return '';
  const str = String(val).trim();
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num <= 0) return str;
  const words = convertNumberToWordsOnly(num);
  return words ? `${words} ONLY` : str;
}
