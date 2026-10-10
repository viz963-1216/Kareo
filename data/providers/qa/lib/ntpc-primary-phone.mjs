// The official PDF places separate telephone numbers on separate lines.
// Preserve that boundary before removing whitespace. A following # extension
// belongs to the first number; another telephone number does not.
export function ntpcPrimaryPhone(raw) {
  const lines = raw.normalize('NFKC').trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const first = lines[0]?.split('或')[0].replace(/\s/g, '') ?? '';
  const extension = !first.includes('#') && /^#[0-9]/.test(lines[1] ?? '')
    ? lines[1].split('或')[0].replace(/\s/g, '') : '';
  const phone = (first + extension).match(/^([0-9-]+(?:#[0-9]+)?)/)?.[1];
  if (!phone) throw new Error('Official source has no usable primary telephone');
  return phone;
}
