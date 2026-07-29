/**
 * Legacy compatibility shim.
 *
 * The SAT Reading Coach visual system intentionally has no persistent mascot.
 * Existing lesson states can keep importing this component while the remaining
 * screens migrate; it renders nothing and therefore removes the former cat from
 * the complete student experience.
 */
export default function MascotCat(_props: {
  mood?: string;
  size?: string;
  className?: string;
}) {
  return null;
}
