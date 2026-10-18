export function toWslPath(p: string): string {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (m) {
    return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
  }
  return p.replace(/\\/g, "/");
}

export function toWindowsPath(p: string): string {
  const m = /^\/mnt\/([A-Za-z])(\/.*)?$/.exec(p);
  if (m) {
    const rest = (m[2] || "/").replace(/\//g, "\\");
    return `${m[1].toUpperCase()}:${rest}`;
  }
  return p;
}

export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
