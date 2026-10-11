// Keep the first official number, including a printed extension. Never guess missing digits.
export function nursingPhone(raw) {
  const text = raw.normalize('NFKC').replace(/\s/g, '').replace(/分機/g, '轉');
  const first = text.split(/[;；、]/)[0];
  const match = first.match(/^(\(?02\)?[-\d]+|09[-\d]+)(?:轉(\d+)(?:或\d+)?)?$/);
  if (!match) return null;
  let base = match[1].replace(/[()-]/g, '');
  let extension = match[2];
  // One source prints 02-27372181-3938: preserve its separated extension.
  if (!extension && /^02-\d{8}-\d+$/.test(match[1])) {
    const parts = match[1].split('-'); base = '02' + parts[1]; extension = parts[2];
  }
  if (!/^(02\d{8}|09\d{8})$/.test(base)) return null;
  return (base.startsWith('02') ? '02-' + base.slice(2) : base) + (extension ? '轉' + extension : '');
}
