export function getAvatarUrl(name: string, size: number = 150): string {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=4F46E5&color=fff&bold=true&font-size=0.4`
}
