export const getOption = (options: Record<string, string | undefined>, key: string): string => decodeURIComponent(options[key] ?? '');
export const encode = (value: string): string => encodeURIComponent(value);

