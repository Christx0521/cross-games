export interface PublicProfile {
  nickname: string;
  avatar_url: string | null;
  description: string | null;
  country_code: string | null;
  languages: string[];
  is_adult: boolean;
}

// Convierte un código de país ISO alpha-2 en su emoji de bandera.
export function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
