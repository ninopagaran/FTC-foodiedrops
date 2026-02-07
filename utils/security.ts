
/**
 * Basic Input Sanitization to prevent XSS in the frontend.
 * Removes HTML tags and dangerous characters.
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove < >
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

export const validateEmail = (email: string): boolean => {
  const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return re.test(email);
};

export const generateIdempotencyKey = (): string => {
  return 'idemp_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};
