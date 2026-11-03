import type { Person } from '@/domain/types';
import { useMediaUrl } from '@/data/media/useMediaUrl';
import { Avatar } from './ui/Avatar';

/** Circular headshot (brand: perfect circles for employee photos) with initials fallback. */
export function PersonAvatar({ person, size = 'md', className }: { person: Pick<Person, 'fullName' | 'headshotMediaId'> | null | undefined; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const url = useMediaUrl(person?.headshotMediaId ?? null);
  return <Avatar name={person?.fullName ?? null} src={url} size={size} className={className} />;
}
