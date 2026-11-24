import type { Priority } from '../models';

export default function PriorityTag({ priority }: { priority: Priority }) {
  return <span className={`tag tag--${priority}`}>{priority}</span>;
}
