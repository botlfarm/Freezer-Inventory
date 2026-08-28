export const compareBoxLabels = (a: string | null | undefined, b: string | null | undefined): number => {
  const strA = (a || '').trim();
  const strB = (b || '').trim();
  if (!strA && !strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;

  // Tokenize string into numeric and non-numeric chunks
  const tokensA = strA.split(/(\d+)/).filter(Boolean);
  const tokensB = strB.split(/(\d+)/).filter(Boolean);
  const minLen = Math.min(tokensA.length, tokensB.length);

  for (let i = 0; i < minLen; i++) {
    const tokA = tokensA[i];
    const tokB = tokensB[i];
    const isNumA = /^\d+$/.test(tokA);
    const isNumB = /^\d+$/.test(tokB);

    if (isNumA && isNumB) {
      try {
        const bigA = BigInt(tokA);
        const bigB = BigInt(tokB);
        if (bigA !== bigB) {
          return bigA < bigB ? -1 : 1;
        }
      } catch {
        const numA = Number(tokA);
        const numB = Number(tokB);
        if (numA !== numB) {
          return numA - numB;
        }
      }
      // If numbers match (e.g. "03334" vs "3334" or "01" vs "1"), continue to next token
    } else if (tokA !== tokB) {
      const cmp = tokA.localeCompare(tokB, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  if (tokensA.length !== tokensB.length) {
    return tokensA.length - tokensB.length;
  }

  return strA.localeCompare(strB, undefined, { sensitivity: 'base' });
};
