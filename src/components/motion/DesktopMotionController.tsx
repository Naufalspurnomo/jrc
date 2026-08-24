import { useScheduleVia } from '../../hooks/useScheduleVia';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useScrubTransitions } from '../../hooks/useScrubTransitions';

export default function DesktopMotionController() {
  useScrubTransitions();
  useScrollReveal({ disabled: true });
  useScheduleVia();

  return null;
}
