interface BrandMarkProps {
  size?: number;
  decorative?: boolean;
}

/** Shared mark for every CouponWorld surface, including the browser icon. */
export function BrandMark({ size = 36, decorative = true }: BrandMarkProps) {
  return (
    <img
      src="/couponworld-mark.svg"
      alt={decorative ? '' : 'CouponWorld logo'}
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', width: size, height: size, flexShrink: 0 }}
    />
  );
}
