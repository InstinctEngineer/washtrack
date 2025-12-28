/**
 * Calculate the Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0 to 1)
 */
export function calculateSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;

  const distance = levenshteinDistance(aLower, bLower);
  const maxLength = Math.max(aLower.length, bLower.length);
  
  return 1 - distance / maxLength;
}

/**
 * Normalize a string for comparison (remove special chars, lowercase)
 */
export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[_\-\.]/g, ' ')  // Replace common separators with spaces
    .replace(/\s+/g, ' ');      // Normalize multiple spaces
}

/**
 * Enhanced similarity that accounts for common naming variations
 */
export function enhancedSimilarity(input: string, candidate: string): number {
  // First check exact match (case-insensitive)
  if (input.toLowerCase().trim() === candidate.toLowerCase().trim()) {
    return 1;
  }

  // Check normalized match (handles FedEx_RST vs FedEx RST)
  const normalizedInput = normalizeForComparison(input);
  const normalizedCandidate = normalizeForComparison(candidate);
  
  if (normalizedInput === normalizedCandidate) {
    return 0.99; // Very high but not exact
  }

  // Calculate base similarity on normalized strings
  const baseSimilarity = calculateSimilarity(normalizedInput, normalizedCandidate);
  
  // Boost score if one contains the other
  if (normalizedInput.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedInput)) {
    return Math.max(baseSimilarity, 0.85);
  }

  return baseSimilarity;
}

export interface SimilarMatch<T> {
  item: T;
  name: string;
  score: number;
}

/**
 * Find similar matches from a list of candidates
 */
export function findSimilarMatches<T extends { id: string; name: string }>(
  input: string,
  candidates: T[],
  threshold: number = 0.5,
  maxResults: number = 3
): SimilarMatch<T>[] {
  if (!input.trim()) return [];

  const matches = candidates
    .map(candidate => ({
      item: candidate,
      name: candidate.name,
      score: enhancedSimilarity(input, candidate.name)
    }))
    .filter(match => match.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return matches;
}
