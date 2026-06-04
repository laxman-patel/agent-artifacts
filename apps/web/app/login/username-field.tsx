"use client";

type UsernameFieldProps = {
  username: string;
  onUsernameChange: (value: string) => void;
};

export function UsernameField({ username, onUsernameChange }: UsernameFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/34">Username</span>
      <input
        autoCapitalize="none"
        autoComplete="username"
        className="w-full border border-foreground/[0.14] bg-card px-3 py-2.5 font-mono text-[13px] text-foreground/85 outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/35"
        maxLength={32}
        minLength={3}
        name="username"
        onChange={(event) => onUsernameChange(event.target.value)}
        pattern="[a-z0-9][a-z0-9_-]*[a-z0-9]"
        placeholder="laxman"
        required
        value={username}
      />
      <span className="mt-2 block text-[12px] leading-5 text-foreground/40">
        Lowercase letters, numbers, hyphens, or underscores. Claimed once at signup.
      </span>
    </label>
  );
}

export function normalizeUsernameInput(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  const normalized = normalizeUsernameInput(value);
  return /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(normalized) && normalized.length >= 3 && normalized.length <= 32;
}
