export interface MyIntegration {
  linked: boolean;
  enabled: boolean;
  steamid64: string | null;
  persona_name: string | null;
  now_playing: string | null;
}

export interface PublicSteam {
  linked: boolean;
  persona_name: string | null;
  profile_public: boolean;
  now_playing: string | null;
}
