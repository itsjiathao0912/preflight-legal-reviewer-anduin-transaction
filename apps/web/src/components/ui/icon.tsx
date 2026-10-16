import type { IconName } from '../../icons/sprite';

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `i ${className}` : 'i'} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}
